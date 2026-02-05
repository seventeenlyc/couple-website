<?php
/**
 * JSON数据持久化辅助函数
 * 提供安全的JSON读写和备份功能
 */

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

/**
 * 安全读取JSON文件
 * @param string $filePath 文件路径
 * @param mixed $default 默认值
 * @return mixed 解析后的数据或默认值
 */
function safeReadJSON($filePath, $default = []) {
    try {
        if (!file_exists($filePath)) {
            error_log("JSON文件不存在: {$filePath}");
            return $default;
        }
        
        $content = file_get_contents($filePath);
        if ($content === false) {
            error_log("无法读取JSON文件: {$filePath}");
            return $default;
        }
        
        $data = json_decode($content, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("JSON解析错误 ({$filePath}): " . json_last_error_msg());
            
            // 尝试从备份恢复
            $backupPath = $filePath . '.backup';
            if (file_exists($backupPath)) {
                error_log("尝试从备份恢复: {$backupPath}");
                $backupContent = file_get_contents($backupPath);
                $backupData = json_decode($backupContent, true);
                
                if (json_last_error() === JSON_ERROR_NONE) {
                    error_log("成功从备份恢复数据");
                    // 恢复主文件
                    file_put_contents($filePath, $backupContent);
                    return $backupData;
                }
            }
            
            return $default;
        }
        
        return $data;
    } catch (Exception $e) {
        error_log("读取JSON文件异常: " . $e->getMessage());
        return $default;
    }
}

/**
 * 安全写入JSON文件（带备份）
 * @param string $filePath 文件路径
 * @param mixed $data 要写入的数据
 * @param bool $createBackup 是否创建备份
 * @return bool 是否成功
 */
function safeWriteJSON($filePath, $data, $createBackup = true) {
    try {
        // 创建备份
        if ($createBackup && file_exists($filePath)) {
            $backupPath = $filePath . '.backup';
            if (!copy($filePath, $backupPath)) {
                error_log("创建备份失败: {$filePath}");
            }
        }
        
        // 编码JSON
        $jsonContent = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        if ($jsonContent === false) {
            error_log("JSON编码错误: " . json_last_error_msg());
            return false;
        }
        
        // 写入临时文件
        $tempPath = $filePath . '.tmp';
        if (file_put_contents($tempPath, $jsonContent) === false) {
            error_log("写入临时文件失败: {$tempPath}");
            return false;
        }
        
        // 验证临时文件
        $verifyData = json_decode(file_get_contents($tempPath), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("临时文件验证失败: " . json_last_error_msg());
            unlink($tempPath);
            return false;
        }
        
        // 原子性替换
        if (!rename($tempPath, $filePath)) {
            error_log("文件替换失败: {$filePath}");
            unlink($tempPath);
            return false;
        }
        
        return true;
    } catch (Exception $e) {
        error_log("写入JSON文件异常: " . $e->getMessage());
        return false;
    }
}

/**
 * 验证JSON文件完整性
 * @param string $filePath 文件路径
 * @return array 包含valid和message的数组
 */
function validateJSONFile($filePath) {
    if (!file_exists($filePath)) {
        return [
            'valid' => false,
            'message' => '文件不存在'
        ];
    }
    
    $content = file_get_contents($filePath);
    if ($content === false) {
        return [
            'valid' => false,
            'message' => '无法读取文件'
        ];
    }
    
    json_decode($content);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return [
            'valid' => false,
            'message' => 'JSON格式错误: ' . json_last_error_msg()
        ];
    }
    
    return [
        'valid' => true,
        'message' => 'JSON文件有效'
    ];
}

/**
 * 创建数据备份
 * @param string $filePath 文件路径
 * @param string $backupDir 备份目录
 * @return bool 是否成功
 */
function createDataBackup($filePath, $backupDir = null) {
    if (!file_exists($filePath)) {
        return false;
    }
    
    if ($backupDir === null) {
        $backupDir = dirname($filePath) . '/backups';
    }
    
    // 确保备份目录存在
    if (!file_exists($backupDir)) {
        mkdir($backupDir, 0755, true);
    }
    
    // 生成备份文件名（带时间戳）
    $fileName = basename($filePath);
    $timestamp = date('Y-m-d_H-i-s');
    $backupPath = $backupDir . '/' . $fileName . '.' . $timestamp . '.backup';
    
    if (copy($filePath, $backupPath)) {
        // 清理旧备份（保留最近10个）
        cleanOldBackups($backupDir, $fileName, 10);
        return true;
    }
    
    return false;
}

/**
 * 清理旧备份文件
 * @param string $backupDir 备份目录
 * @param string $fileName 文件名
 * @param int $keepCount 保留数量
 */
function cleanOldBackups($backupDir, $fileName, $keepCount = 10) {
    $pattern = $backupDir . '/' . $fileName . '.*.backup';
    $backups = glob($pattern);
    
    if (count($backups) > $keepCount) {
        // 按修改时间排序
        usort($backups, function($a, $b) {
            return filemtime($b) - filemtime($a);
        });
        
        // 删除多余的备份
        $toDelete = array_slice($backups, $keepCount);
        foreach ($toDelete as $file) {
            unlink($file);
        }
    }
}

/**
 * 恢复数据从备份
 * @param string $filePath 文件路径
 * @param string $backupPath 备份路径（可选）
 * @return bool 是否成功
 */
function restoreFromBackup($filePath, $backupPath = null) {
    if ($backupPath === null) {
        $backupPath = $filePath . '.backup';
    }
    
    if (!file_exists($backupPath)) {
        error_log("备份文件不存在: {$backupPath}");
        return false;
    }
    
    // 验证备份文件
    $validation = validateJSONFile($backupPath);
    if (!$validation['valid']) {
        error_log("备份文件无效: " . $validation['message']);
        return false;
    }
    
    // 恢复
    if (copy($backupPath, $filePath)) {
        error_log("成功从备份恢复: {$filePath}");
        return true;
    }
    
    return false;
}

/**
 * 获取JSON文件统计信息
 * @param string $filePath 文件路径
 * @return array 统计信息
 */
function getJSONFileStats($filePath) {
    $stats = [
        'exists' => file_exists($filePath),
        'size' => 0,
        'modified' => null,
        'valid' => false,
        'item_count' => 0
    ];
    
    if ($stats['exists']) {
        $stats['size'] = filesize($filePath);
        $stats['modified'] = date('Y-m-d H:i:s', filemtime($filePath));
        
        $validation = validateJSONFile($filePath);
        $stats['valid'] = $validation['valid'];
        
        if ($stats['valid']) {
            $data = safeReadJSON($filePath);
            if (is_array($data)) {
                $stats['item_count'] = count($data);
            }
        }
    }
    
    return $stats;
}
