import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { ROOT_DIR, DATA_DIR, loadConfig } from '../src/config.js';
import { initDb, closeDb } from '../src/storage/db.js';

function safeReadJson(filePath, defaultValue = null) {
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[WARN] Failed to parse JSON at ${filePath}: ${e.message}`);
    return defaultValue;
  }
}

export function runImport(options = {}) {
  const isDryRun = !!options.dryRun;
  const dataDir = options.dataDir || DATA_DIR;
  const dbPath = options.dbPath || (isDryRun ? ':memory:' : loadConfig().dbPath);
  const deviceStorePath = options.deviceStorePath || process.env.COUPLE_DEVICE_STORE;

  console.log(`=== Starting Legacy Data Import ===`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (No database writes)' : 'APPLY (Writing to SQLite)'}`);
  console.log(`Source Data Dir: ${dataDir}`);
  console.log(`Target Database: ${dbPath}`);

  const db = initDb(dbPath);
  const report = {
    configs: 0,
    users: 0,
    tasks: 0,
    taskInstances: 0,
    products: 0,
    orders: 0,
    virtualItems: 0,
    reviews: 0,
    albumFolders: 0,
    albumPhotos: 0,
    privateNotes: 0,
    privateFiles: 0,
    whispers: 0,
    storyEvents: 0,
    deviceRecords: 0,
    deviceBindings: 0,
    warnings: []
  };

  const transaction = db.transaction(() => {
    // 1. config.json
    const configPath = path.join(dataDir, 'config.json');
    const configData = safeReadJson(configPath);
    if (configData) {
      // Check start_date conflict
      const rootStartDate = configData.startDate;
      const siteStartDate = configData.site?.start_date;
      if (rootStartDate && siteStartDate && rootStartDate !== siteStartDate) {
        report.warnings.push(`startDate conflict: root='${rootStartDate}' vs site.start_date='${siteStartDate}'. Preserving site.start_date.`);
      }
      const effectiveStartDate = siteStartDate || rootStartDate || '2025-02-05';

      const insertConfig = db.prepare('INSERT OR REPLACE INTO site_config (key, value) VALUES (?, ?)');
      insertConfig.run('startDate', effectiveStartDate);
      insertConfig.run('site', JSON.stringify(configData.site || {}));
      insertConfig.run('theme', JSON.stringify(configData.theme || {}));
      insertConfig.run('specialDates', JSON.stringify(configData.specialDates || {}));
      insertConfig.run('ai', JSON.stringify(configData.ai || {}));
      insertConfig.run('shop', JSON.stringify(configData.shop || {}));
      report.configs += 6;

      // Users
      const users = configData.users || {};
      const userList = Object.entries(users);

      // Build name -> id map
      const nameToId = {};
      for (const [name, u] of userList) {
        nameToId[name] = u.id || name;
      }

      const insertUser = db.prepare(`
        INSERT OR REPLACE INTO users (id, username, password_hash, private_password_hash, partner_id, birthday, avatar, balance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const [name, u] of userList) {
        const userId = u.id || name;
        const partnerId = u.partner ? (nameToId[u.partner] || u.partner) : null;
        
        let passwordHash = u.password || '';
        if (passwordHash && !passwordHash.startsWith('$2') && !passwordHash.startsWith('$argon2')) {
          passwordHash = bcrypt.hashSync(passwordHash, 10);
        }

        let privatePasswordHash = u.privatePassword || '';
        if (privatePasswordHash && !privatePasswordHash.startsWith('$2') && !privatePasswordHash.startsWith('$argon2')) {
          privatePasswordHash = bcrypt.hashSync(privatePasswordHash, 10);
        }

        insertUser.run(
          userId,
          name,
          passwordHash,
          privatePasswordHash,
          partnerId,
          u.birthday || '',
          u.avatar || '',
          Number(u.balance || 1000)
        );
        report.users++;
      }
    } else {
      report.warnings.push(`config.json not found in ${dataDir}`);
    }

    // 2. user_currency.json (if exists)
    const currencyPath = path.join(dataDir, 'user_currency.json');
    const currencyData = safeReadJson(currencyPath);
    if (currencyData && typeof currencyData === 'object') {
      const updateUserCurrency = db.prepare(`
        UPDATE users 
        SET balance = ?,
            total_earned = COALESCE(?, total_earned),
            total_spent = COALESCE(?, total_spent),
            streak_days = COALESCE(?, streak_days),
            last_checkin = COALESCE(?, last_checkin)
        WHERE id = ?
      `);
      const insertCheckin = db.prepare(`
        INSERT OR IGNORE INTO checkins (id, user_id, business_date, streak_days, reward, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const insertTx = db.prepare(`
        INSERT OR IGNORE INTO wallet_transactions (id, user_id, type, amount, balance_after, description, reference_id, idempotency_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const [uid, info] of Object.entries(currencyData)) {
        if (!info || typeof info !== 'object') continue;

        updateUserCurrency.run(
          Number(info.balance ?? 0),
          info.total_earned !== undefined ? Number(info.total_earned) : null,
          info.total_spent !== undefined ? Number(info.total_spent) : null,
          info.streak_days !== undefined ? Number(info.streak_days) : null,
          info.last_checkin || null,
          uid
        );

        const txList = Array.isArray(info.transactions)
          ? info.transactions
          : Array.isArray(info.history)
            ? info.history
            : [];

        const recordedCheckinDates = new Set();

        for (const tx of txList) {
          const txId = tx.id || `tx_${Math.random().toString(36).substring(2)}`;
          const isExpense = tx.type === 'expense' || tx.source === 'purchase' || Number(tx.amount || 0) < 0;
          const type = isExpense ? 'expense' : (tx.type || 'income');
          const amount = isExpense ? -Math.abs(Number(tx.amount || 0)) : Math.abs(Number(tx.amount || 0));
          const balanceAfter = Number(tx.balance_after ?? tx.balance ?? 0);
          const desc = tx.description || '';
          const timestamp = tx.timestamp || tx.created_at || new Date().toISOString();
          const isCheckin = tx.source === 'checkin' || desc.includes('签到');
          const txDate = timestamp.slice(0, 10);

          insertTx.run(
            txId,
            uid,
            type,
            amount,
            balanceAfter,
            desc,
            tx.reference_id || null,
            tx.id || null,
            timestamp
          );

          if (isCheckin) {
            recordedCheckinDates.add(txDate);
            insertCheckin.run(
              `chk_${uid}_${txDate}`,
              uid,
              txDate,
              Number(info.streak_days || 1),
              Math.abs(amount),
              timestamp
            );
          }
        }

        if (Array.isArray(info.checkin_history)) {
          for (const date of info.checkin_history) {
            if (!recordedCheckinDates.has(date)) {
              recordedCheckinDates.add(date);
              insertCheckin.run(`chk_${uid}_${date}`, uid, date, 1, 10, `${date} 08:00:00`);
            }
          }
        }

        if (info.last_checkin && !recordedCheckinDates.has(info.last_checkin)) {
          recordedCheckinDates.add(info.last_checkin);
          insertCheckin.run(
            `chk_${uid}_${info.last_checkin}`,
            uid,
            info.last_checkin,
            Number(info.streak_days || 1),
            0,
            `${info.last_checkin} 08:00:00`
          );
        }
      }
    }

    // 3. Products: products.json or products.txt
    const productsJsonPath = path.join(dataDir, 'products.json');
    const productsTxtPath = path.join(dataDir, 'products.txt');
    const insertProduct = db.prepare(`
      INSERT OR REPLACE INTO products (id, name, description, price, category, stock, image, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    if (fs.existsSync(productsJsonPath)) {
      const pData = safeReadJson(productsJsonPath);
      const list = pData?.products || [];
      let sort = 0;
      for (const p of list) {
        insertProduct.run(
          p.id || `prod_${++sort}`,
          p.name,
          p.description || '',
          Number(p.price || 0),
          p.category || 'virtual',
          Number(p.stock ?? -1),
          p.image || '',
          sort
        );
        report.products++;
      }
    } else if (fs.existsSync(productsTxtPath)) {
      const lines = fs.readFileSync(productsTxtPath, 'utf8').split('\n');
      let sort = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const parts = trimmed.split('|').map(s => s.trim());
        if (parts.length >= 2) {
          const name = parts[0];
          const price = Number(parts[1]) || 0;
          const image = parts[2] || '';
          const desc = parts[3] || '';
          const cat = parts[4] || 'virtual';
          const stock = parts[5] ? Number(parts[5]) : -1;
          insertProduct.run(`prod_${++sort}`, name, desc, price, cat, stock, image, sort);
          report.products++;
        }
      }
    }

    // 4. Tasks: tasks.json or tasks.txt
    const tasksJsonPath = path.join(dataDir, 'tasks.json');
    const tasksTxtPath = path.join(dataDir, 'tasks.txt');
    const insertTask = db.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, reward, category, icon, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    if (fs.existsSync(tasksJsonPath)) {
      const tData = safeReadJson(tasksJsonPath);
      const list = tData?.task_pool || [];
      let sort = 0;
      for (const t of list) {
        insertTask.run(
          t.id || `task_${++sort}`,
          t.title,
          t.description || '',
          Number(t.reward || 10),
          t.category || 'daily',
          t.icon || '',
          sort
        );
        report.tasks++;
      }
      if (Array.isArray(tData?.daily_tasks)) {
        const insertDaily = db.prepare(`
          INSERT OR REPLACE INTO task_daily_instances (id, business_date, task_id, title, description, reward, completed_by, confirmed_by, reward_given)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const dt of tData.daily_tasks) {
          insertDaily.run(
            dt.id || `dt_${dt.task_id}_${dt.date}`,
            dt.date || new Date().toISOString().slice(0, 10),
            dt.task_id,
            dt.title || '',
            dt.description || '',
            Number(dt.reward || 10),
            JSON.stringify(dt.completed_by || []),
            JSON.stringify(dt.confirmed_by || []),
            dt.reward_given ? 1 : 0
          );
          report.taskInstances++;
        }
      }
    } else if (fs.existsSync(tasksTxtPath)) {
      const lines = fs.readFileSync(tasksTxtPath, 'utf8').split('\n');
      let sort = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const parts = trimmed.split('|').map(s => s.trim());
        if (parts.length >= 2) {
          const title = parts[0];
          const desc = parts[1] || '';
          const minR = Number(parts[2]) || 10;
          const maxR = Number(parts[3]) || minR;
          const cat = parts[4] || 'daily';
          insertTask.run(`task_${++sort}`, title, desc, Math.round((minR + maxR) / 2), cat, '', sort);
          report.tasks++;
        }
      }
    }

    // 5. Orders: orders.json
    const ordersPath = path.join(dataDir, 'orders.json');
    if (fs.existsSync(ordersPath)) {
      const oData = safeReadJson(ordersPath);
      const orders = oData?.orders || [];
      const insertOrder = db.prepare(`
        INSERT OR REPLACE INTO orders (id, order_no, user_id, product_id, product_name, product_price, paid_price, discount_rate, discount_reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const o of orders) {
        insertOrder.run(
          o.id,
          o.order_no || o.id,
          o.user_id,
          o.product_id,
          o.product_name || '',
          Number(o.price || o.product_price || 0),
          Number(o.paid_price || o.price || 0),
          Number(o.discount_rate || 1.0),
          o.discount_reason || '',
          o.status || 'completed',
          o.created_at || new Date().toISOString()
        );
        report.orders++;
      }
    }

    // 6. Virtual Items: virtual_items.json
    const vitemPath = path.join(dataDir, 'virtual_items.json');
    if (fs.existsSync(vitemPath)) {
      const vData = safeReadJson(vitemPath);
      const items = vData?.items || [];
      const insertVitem = db.prepare(`
        INSERT OR REPLACE INTO virtual_items (id, order_id, user_id, product_id, name, status, used_at, confirmed_by, confirmed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const v of items) {
        insertVitem.run(
          v.id,
          v.order_id,
          v.user_id,
          v.product_id,
          v.name || v.product_name || '',
          v.status || 'unused',
          v.used_at || null,
          v.confirmed_by || null,
          v.confirmed_at || null,
          v.purchased_at || v.created_at || new Date().toISOString()
        );
        report.virtualItems++;
      }
    }

    // 7. Reviews: reviews.json
    const reviewsPath = path.join(dataDir, 'reviews.json');
    if (fs.existsSync(reviewsPath)) {
      const rData = safeReadJson(reviewsPath);
      const reviews = rData?.reviews || [];
      const insertReview = db.prepare(`
        INSERT OR REPLACE INTO reviews (id, user_id, product_id, order_id, rating, content, reply, reply_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of reviews) {
        insertReview.run(
          r.id,
          r.user_id,
          r.product_id,
          r.order_id || null,
          Number(r.rating || 5),
          r.content || '',
          r.reply || null,
          r.reply_at || null,
          r.created_at || new Date().toISOString()
        );
        report.reviews++;
      }
    }

    // 8. Album: album.json
    const albumPath = path.join(dataDir, 'album.json');
    if (fs.existsSync(albumPath)) {
      const aData = safeReadJson(albumPath);
      const folders = aData?.folders || [];
      const photos = aData?.photos || [];
      const insertFolder = db.prepare(`
        INSERT OR REPLACE INTO album_folders (id, context, user_id, name, path, parent_path, created_at)
        VALUES (?, 'album', NULL, ?, ?, ?, ?)
      `);
      for (const f of folders) {
        insertFolder.run(
          f.id || `f_${Math.random().toString(36).slice(2)}`,
          f.name,
          f.path,
          f.parent_path || '/',
          f.created_at || new Date().toISOString()
        );
        report.albumFolders++;
      }

      const insertPhoto = db.prepare(`
        INSERT OR REPLACE INTO album_photos (id, folder_path, filename, original_path, thumbnail_path, title, description, tags, uploaded_by, size, width, height, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of photos) {
        insertPhoto.run(
          p.id || `p_${Math.random().toString(36).slice(2)}`,
          p.folder_path || '/',
          p.filename || path.basename(p.path || ''),
          p.path || p.original_path,
          p.thumbnail_path || null,
          p.title || '',
          p.description || '',
          Array.isArray(p.tags) ? p.tags.join(',') : (p.tags || ''),
          p.uploaded_by || 'unknown',
          Number(p.size || 0),
          Number(p.width || 0),
          Number(p.height || 0),
          p.created_at || p.uploaded_at || new Date().toISOString()
        );
        report.albumPhotos++;
      }
    }

    // 9. Private data: private_<userId>.json
    const files = fs.readdirSync(dataDir);
    const privateFiles = files.filter(f => f.startsWith('private_') && f.endsWith('.json'));
    for (const pf of privateFiles) {
      const uidMatch = pf.match(/^private_(.+)\.json$/);
      if (!uidMatch) continue;
      const uid = uidMatch[1];
      const pData = safeReadJson(path.join(dataDir, pf));
      if (!pData) continue;

      const notes = pData.notes || [];
      const pfiles = pData.files || [];
      const pfolders = pData.folders || [];

      const insertNote = db.prepare(`
        INSERT OR REPLACE INTO private_notes (id, user_id, title, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const n of notes) {
        insertNote.run(
          n.id,
          uid,
          n.title || '',
          n.content || '',
          n.created_at || new Date().toISOString(),
          n.updated_at || n.created_at || new Date().toISOString()
        );
        report.privateNotes++;
      }

      const insertPFile = db.prepare(`
        INSERT OR REPLACE INTO private_files (id, user_id, folder_path, original_name, stored_filename, stored_path, mime_type, size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const f of pfiles) {
        const storedFilename = f.stored_filename || f.stored_name || f.filename || '';
        let storedPath = f.stored_path || f.storage_path || '';
        if (!storedPath) {
          if (f.path && !f.path.includes('.php')) {
            storedPath = f.path;
          } else if (storedFilename) {
            storedPath = `uploads/private/${uid}/${storedFilename}`;
          }
        }
        if (storedPath) {
          storedPath = storedPath.replace(/^[\\\/]+/, '').replace(/\\/g, '/');
        }
        const createdAt = f.created_at || f.uploaded_at || new Date().toISOString();

        insertPFile.run(
          f.id,
          uid,
          f.folder_path || '/',
          f.original_name || f.filename || '',
          storedFilename,
          storedPath,
          f.mime_type || '',
          Number(f.size || 0),
          createdAt
        );
        report.privateFiles++;
      }

      const insertPFolder = db.prepare(`
        INSERT OR REPLACE INTO album_folders (id, context, user_id, name, path, parent_path, created_at)
        VALUES (?, 'private', ?, ?, ?, ?, ?)
      `);
      for (const f of pfolders) {
        insertPFolder.run(
          f.id || `pf_${Math.random().toString(36).slice(2)}`,
          uid,
          f.name,
          f.path,
          f.parent_path || '/',
          f.created_at || new Date().toISOString()
        );
      }
    }

    // 10. Whispers: whispers.json
    const whispersPath = path.join(dataDir, 'whispers.json');
    if (fs.existsSync(whispersPath)) {
      const wData = safeReadJson(whispersPath);
      const whispers = wData?.whispers || [];
      const insertWhisper = db.prepare(`
        INSERT OR REPLACE INTO whispers (id, sender_id, receiver_id, content, is_read, read_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const w of whispers) {
        insertWhisper.run(
          w.id,
          w.from_user || w.sender_id,
          w.to_user || w.receiver_id,
          w.content || '',
          w.read ? 1 : 0,
          w.read_at || null,
          w.created_at || new Date().toISOString()
        );
        report.whispers++;
      }
    }

    // 11. Story: story_events.json
    const storyPath = path.join(dataDir, 'story_events.json');
    if (fs.existsSync(storyPath)) {
      const sData = safeReadJson(storyPath);
      const events = Array.isArray(sData) ? sData : (sData?.events || []);
      const insertStory = db.prepare(`
        INSERT OR REPLACE INTO story_events (id, source, type, event_date, title, content, photos, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of events) {
        insertStory.run(
          s.id,
          s.source || 'manual',
          s.type || 'custom',
          s.date || s.event_date || new Date().toISOString().slice(0, 10),
          s.title || '',
          s.content || '',
          JSON.stringify(s.photos || []),
          s.created_by || null,
          s.created_at || new Date().toISOString()
        );
        report.storyEvents++;
      }
    }

    // 12. Device state: external state.json
    let resolvedDevicePath = deviceStorePath;
    if (!resolvedDevicePath) {
      // Check default fallback: ../.couple-device-state/...
      const possibleDefault = path.resolve(ROOT_DIR, '..', '.couple-device-state', path.basename(ROOT_DIR), 'state.json');
      if (fs.existsSync(possibleDefault)) {
        resolvedDevicePath = possibleDefault;
      }
    }

    if (resolvedDevicePath && fs.existsSync(resolvedDevicePath)) {
      const dState = safeReadJson(resolvedDevicePath);
      if (dState && dState.version === 1) {
        const insertBinding = db.prepare('INSERT OR REPLACE INTO device_bindings (user_id, first_bound_at) VALUES (?, ?)');
        for (const [uid, boundAt] of Object.entries(dState.bound || {})) {
          insertBinding.run(uid, Number(boundAt));
          report.deviceBindings++;
        }

        const insertRecord = db.prepare(`
          INSERT OR REPLACE INTO device_records (id, user_id, name, secret_hash, status, pair_code, pair_failures, created_at, expires_at, last_seen, agent, ip, approved_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const [did, r] of Object.entries(dState.devices || {})) {
          insertRecord.run(
            did,
            r.user_id,
            r.name || '',
            r.secret_hash,
            r.status,
            r.pair_code || null,
            Number(r.pair_failures || 0),
            Number(r.created_at || 0),
            Number(r.expires_at || 0),
            Number(r.last_seen || 0),
            r.agent || '',
            r.ip || '',
            r.approved_by || null
          );
          report.deviceRecords++;
        }

        const insertRate = db.prepare('INSERT OR REPLACE INTO device_rates (rate_key, count, until_epoch) VALUES (?, ?, ?)');
        for (const [k, v] of Object.entries(dState.rates || {})) {
          insertRate.run(k, Number(v.count || 1), Number(v.until || 0));
        }
      }
    }
  });

  if (isDryRun) {
    // Run inside memory or rollback transaction
    transaction();
    console.log(`[DRY-RUN COMPLETE] Validation passed!`);
  } else {
    transaction();
    console.log(`[APPLY COMPLETE] Legacy data imported successfully into SQLite!`);
  }

  console.log(`Import Summary:`);
  console.log(`- Config entries: ${report.configs}`);
  console.log(`- Users: ${report.users}`);
  console.log(`- Tasks: ${report.tasks} (daily instances: ${report.taskInstances})`);
  console.log(`- Products: ${report.products}`);
  console.log(`- Orders: ${report.orders}`);
  console.log(`- Virtual items: ${report.virtualItems}`);
  console.log(`- Reviews: ${report.reviews}`);
  console.log(`- Album folders: ${report.albumFolders}, photos: ${report.albumPhotos}`);
  console.log(`- Private notes: ${report.privateNotes}, files: ${report.privateFiles}`);
  console.log(`- Whispers: ${report.whispers}`);
  console.log(`- Story events: ${report.storyEvents}`);
  console.log(`- Device records: ${report.deviceRecords}, bindings: ${report.deviceBindings}`);
  if (report.warnings.length > 0) {
    console.log(`Warnings:`);
    report.warnings.forEach(w => console.log(`  ! ${w}`));
  }

  if (isDryRun) {
    closeDb();
  }

  return report;
}

// Direct execution from CLI
if (process.argv[1] && process.argv[1].endsWith('import-legacy.js')) {
  const isDryRun = process.argv.includes('--dry-run');
  try {
    runImport({ dryRun: isDryRun });
    process.exit(0);
  } catch (err) {
    console.error('Import failed with error:', err);
    process.exit(1);
  }
}
