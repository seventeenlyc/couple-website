<?php
/**
 * Story timeline API
 * A complete relationship timeline: start day, recurring special dates,
 * upload history, and manually added scrapbook notes/photos.
 */
define('INCLUDED', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/json-helper.php';

// Ensure no accidental output before JSON
ini_set('display_errors', 0);
error_reporting(E_ALL);

initSession();
header('Content-Type: application/json; charset=utf-8');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => '请先登录'], JSON_UNESCAPED_UNICODE);
    exit();
}


$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    handleGetTimeline();
    exit();
}

if ($method === 'POST') {
    handleCreateEvent();
    exit();
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => '方法不允许'], JSON_UNESCAPED_UNICODE);

function handleGetTimeline() {
    $startDate = getStartDate();
    $today = date('Y-m-d');
    $duration = calculateLoveDuration($startDate);

    $events = [];
    $events[] = [
        'id' => 'system_start_' . $startDate,
        'source' => 'system',
        'type' => 'start',
        'date' => $startDate,
        'title' => '恋爱第一天',
        'content' => '从这一天开始，时间有了新的刻度。',
        'photos' => [],
        'created_by' => '',
        'created_at' => $startDate . ' 00:00:00',
        'count' => 1,
    ];

    $events = array_merge($events, buildSpecialDateEvents($startDate, $today));
    $events = array_merge($events, buildUploadHistoryEvents($startDate, $today));
    $events = array_merge($events, loadManualEvents($startDate, $today));

    usort($events, function ($a, $b) {
        $dateCompare = strcmp($a['date'], $b['date']);
        if ($dateCompare !== 0) {
            return $dateCompare;
        }
        $order = ['start' => 0, 'anniversary' => 1, 'birthday' => 2, 'manual' => 3, 'upload' => 4];
        return ($order[$a['type']] ?? 9) <=> ($order[$b['type']] ?? 9);
    });

    if (ob_get_level()) ob_clean();
    echo json_encode([
        'success' => true,
        'summary' => [
            'start_date' => $startDate,
            'today' => $today,
            'total_days' => $duration['days'],
            'years' => $duration['years'],
            'months' => $duration['months'],
            'days' => $duration['remainingDays'],
            'event_count' => count($events),
        ],
        'events' => $events,
    ], JSON_UNESCAPED_UNICODE);
}

function handleCreateEvent() {
    $csrfToken = $_POST['csrf_token'] ?? '';
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '请求无效，请重新尝试'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $date = trim($_POST['date'] ?? '');
    $title = trim($_POST['title'] ?? '');
    $content = trim($_POST['content'] ?? '');

    if (!isValidDate($date)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '请选择有效日期'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($title === '' && $content === '' && empty($_FILES['photo']['name'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '请写一点内容，或选择一张照片'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $photos = [];
    if (isset($_FILES['photo']) && $_FILES['photo']['error'] !== UPLOAD_ERR_NO_FILE) {
        $upload = saveStoryPhoto($_FILES['photo']);
        if (!$upload['success']) {
            http_response_code(400);
            echo json_encode($upload, JSON_UNESCAPED_UNICODE);
            exit();
        }
        $photos[] = $upload['photo'];
    }

    $dataFile = getManualEventsFile();
    $data = safeReadJSON($dataFile, ['events' => []]);
    if (!isset($data['events']) || !is_array($data['events'])) {
        $data['events'] = [];
    }

    $event = [
        'id' => 'story_' . uniqid() . '_' . time(),
        'source' => 'manual',
        'type' => 'manual',
        'date' => $date,
        'title' => sanitizeInput($title),
        'content' => sanitizeInput($content),
        'photos' => $photos,
        'created_by' => getCurrentUser(),
        'created_at' => date('Y-m-d H:i:s'),
        'count' => max(1, count($photos)),
    ];

    $data['events'][] = $event;

    if (!safeWriteJSON($dataFile, $data)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '保存失败，请重试'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if (ob_get_level()) ob_clean();
    echo json_encode([
        'success' => true,
        'message' => '已经贴到时光轴上',
        'event' => $event,
    ], JSON_UNESCAPED_UNICODE);
}

function buildSpecialDateEvents($startDate, $today) {
    $events = [];
    $config = getConfig(null, []);
    $startYear = (int)substr($startDate, 0, 4);
    $endYear = (int)substr($today, 0, 4);
    $anniversaryMd = $config['specialDates']['anniversary']['date'] ?? substr($startDate, 5, 5);
    $anniversaryName = $config['specialDates']['anniversary']['name'] ?? '恋爱纪念日';

    for ($year = $startYear; $year <= $endYear; $year++) {
        $date = dateFromMonthDay($year, $anniversaryMd);
        if ($date !== null && $date > $startDate && $date <= $today) {
            $years = max(0, $year - $startYear);
            $events[] = [
                'id' => 'special_anniversary_' . $date,
                'source' => 'system',
                'type' => 'anniversary',
                'date' => $date,
                'title' => $years > 0 ? '在一起 ' . $years . ' 周年' : $anniversaryName,
                'content' => $years > 0 ? '这一年也被认真走过了。' : '我们把这一天记在了第一页。',
                'photos' => [],
                'created_by' => '',
                'created_at' => $date . ' 00:00:00',
                'count' => 1,
            ];
        }
    }

    $birthdays = $config['specialDates']['birthdays'] ?? [];
    if (empty($birthdays) && isset($config['users']) && is_array($config['users'])) {
        foreach ($config['users'] as $name => $user) {
            if (!empty($user['birthday'])) {
                $birthdays[] = ['date' => $user['birthday'], 'name' => $name . '生日'];
            }
        }
    }

    foreach ($birthdays as $birthday) {
        $md = $birthday['date'] ?? '';
        $name = $birthday['name'] ?? '生日';
        for ($year = $startYear; $year <= $endYear; $year++) {
            $date = dateFromMonthDay($year, $md);
            if ($date !== null && $date >= $startDate && $date <= $today) {
                $events[] = [
                    'id' => 'special_birthday_' . md5($name . $date),
                    'source' => 'system',
                    'type' => 'birthday',
                    'date' => $date,
                    'title' => $name,
                    'content' => '今天要被偏爱多一点。',
                    'photos' => [],
                    'created_by' => '',
                    'created_at' => $date . ' 00:00:00',
                    'count' => 1,
                ];
            }
        }
    }

    return $events;
}

function buildUploadHistoryEvents($startDate, $today) {
    $album = safeReadJSON(__DIR__ . '/../data/album.json', ['photos' => []]);
    $photos = isset($album['photos']) && is_array($album['photos']) ? $album['photos'] : [];
    $days = [];

    foreach ($photos as $photo) {
        if (!is_array($photo) || empty($photo['path'])) {
            continue;
        }

        $date = resolvePhotoDate($photo);
        if ($date < $startDate || $date > $today) {
            continue;
        }

        if (!isset($days[$date])) {
            $days[$date] = [
                'id' => 'upload_' . $date,
                'source' => 'album',
                'type' => 'upload',
                'date' => $date,
                'title' => '上传了新的照片',
                'content' => '',
                'photos' => [],
                'created_by' => '',
                'created_at' => $date . ' 00:00:00',
                'count' => 0,
            ];
        }

        $days[$date]['count']++;
        if (!empty($photo['uploaded_by']) && $days[$date]['created_by'] === '') {
            $days[$date]['created_by'] = (string)$photo['uploaded_by'];
        }
        if (count($days[$date]['photos']) < 6) {
            $days[$date]['photos'][] = [
                'id' => (string)($photo['id'] ?? ''),
                'path' => (string)$photo['path'],
                'thumb_path' => (string)($photo['thumb_path'] ?? $photo['path']),
                'title' => (string)($photo['title'] ?? $photo['filename'] ?? ''),
            ];
        }
    }

    foreach ($days as &$event) {
        $event['title'] = '上传了 ' . $event['count'] . ' 张照片';
        $event['content'] = '这一天被放进了相册，也贴到了时间轴上。';
    }
    unset($event);

    return array_values($days);
}

function loadManualEvents($startDate, $today) {
    $data = safeReadJSON(getManualEventsFile(), ['events' => []]);
    $events = isset($data['events']) && is_array($data['events']) ? $data['events'] : [];

    return array_values(array_filter($events, function ($event) use ($startDate, $today) {
        if (!is_array($event) || empty($event['date'])) {
            return false;
        }
        return $event['date'] >= $startDate && $event['date'] <= $today;
    }));
}

function saveStoryPhoto($file) {
    $validation = validateStoryImage($file);
    if (!$validation['success']) {
        return $validation;
    }

    $uploadDir = __DIR__ . '/../uploads/story/';
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
        return ['success' => false, 'message' => '无法创建上传目录'];
    }

    $timestamp = round(microtime(true) * 1000);
    $fileName = uniqid() . '_' . $timestamp . '.' . $validation['extension'];
    $filePath = $uploadDir . $fileName;
    $relativePath = 'uploads/story/' . $fileName;

    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        return ['success' => false, 'message' => '文件保存失败'];
    }

    return [
        'success' => true,
        'photo' => [
            'id' => 'story_photo_' . uniqid(),
            'path' => $relativePath,
            'thumb_path' => $relativePath,
            'title' => sanitizeInput(pathinfo($file['name'], PATHINFO_FILENAME)),
            'mime_type' => $validation['mime_type'],
            'file_size' => $file['size'],
        ],
    ];
}

function validateStoryImage($file) {
    $allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
    $allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    $maxSize = 10 * 1024 * 1024;

    if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
        return ['success' => false, 'message' => '照片上传失败'];
    }

    $extension = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
    if (!in_array($extension, $allowedTypes, true)) {
        return ['success' => false, 'message' => '只支持 JPG、PNG、GIF 格式的图片'];
    }

    if (($file['size'] ?? 0) > $maxSize) {
        return ['success' => false, 'message' => '图片大小不能超过 10MB'];
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, $allowedMimeTypes, true) || getimagesize($file['tmp_name']) === false) {
        return ['success' => false, 'message' => '文件不是有效图片'];
    }

    return ['success' => true, 'extension' => $extension, 'mime_type' => $mimeType];
}

function resolvePhotoDate(array $photo) {
    $folderDate = extractDateFromFolderPath((string)($photo['folder_path'] ?? ''));
    if ($folderDate !== null) {
        return $folderDate;
    }

    $uploadedAt = (string)($photo['uploaded_at'] ?? '');
    if ($uploadedAt !== '') {
        try {
            return (new DateTime($uploadedAt))->format('Y-m-d');
        } catch (Exception $e) {
            return date('Y-m-d');
        }
    }

    return date('Y-m-d');
}

function extractDateFromFolderPath($path) {
    $path = str_replace('\\', '/', $path);
    if (!preg_match('~(?:^|/)Date/((?:\d{2,4}\.)?\d{1,2}\.\d{1,2})$~u', $path, $matches)) {
        return null;
    }

    $parts = explode('.', $matches[1]);
    if (count($parts) === 3) {
        $year = (int)$parts[0];
        $month = (int)$parts[1];
        $day = (int)$parts[2];
        if ($year < 100) {
            $year += 2000;
        }
    } elseif (count($parts) === 2) {
        $year = (int)substr(getStartDate(), 0, 4);
        $month = (int)$parts[0];
        $day = (int)$parts[1];
    } else {
        return null;
    }

    if (!checkdate($month, $day, $year)) {
        return null;
    }

    return sprintf('%04d-%02d-%02d', $year, $month, $day);
}

function dateFromMonthDay($year, $monthDay) {
    if (!preg_match('/^(\d{1,2})-(\d{1,2})$/', $monthDay, $matches)) {
        return null;
    }

    $month = (int)$matches[1];
    $day = (int)$matches[2];
    if (!checkdate($month, $day, $year)) {
        return null;
    }

    return sprintf('%04d-%02d-%02d', $year, $month, $day);
}

function isValidDate($date) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return false;
    }
    [$year, $month, $day] = array_map('intval', explode('-', $date));
    return checkdate($month, $day, $year);
}

function getManualEventsFile() {
    return __DIR__ . '/../data/story_events.json';
}
?>
