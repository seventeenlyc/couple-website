<?php
/**
 * 文件夹管理辅助函数
 * 提供文件夹创建、重命名、删除、移动等核心操作
 */

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

require_once __DIR__ . '/json-helper.php';

/**
 * 验证文件夹名称
 * @param string $name 文件夹名称
 * @return array ['valid' => bool, 'message' => string]
 */
function validateFolderName($name) {
    // 检查空名称或纯空白字符
    if (empty(trim($name))) {
        return [
            'valid' => false,
            'message' => '文件夹名称不能为空'
        ];
    }
    
    // 检查长度限制（最大255字符）
    if (mb_strlen($name) > 255) {
        return [
            'valid' => false,
            'message' => '文件夹名称过长（最大255字符）'
        ];
    }
    
    // 检查非法字符（不允许 / \ : * ? " < > |）
    $illegalChars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    foreach ($illegalChars as $char) {
        if (strpos($name, $char) !== false) {
            return [
                'valid' => false,
                'message' => '文件夹名称包含非法字符'
            ];
        }
    }
    
    return [
        'valid' => true,
        'message' => '验证通过'
    ];
}

/**
 * 检查文件夹是否存在
 * @param array $data 数据数组（包含folders字段）
 * @param string $path 文件夹路径
 * @return bool
 */
function folderExists($data, $path) {
    // 确保folders字段存在
    if (!isset($data['folders']) || !is_array($data['folders'])) {
        return false;
    }
    
    // 遍历查找匹配的路径
    foreach ($data['folders'] as $folder) {
        if (isset($folder['path']) && $folder['path'] === $path) {
            return true;
        }
    }
    
    return false;
}

/**
 * 生成面包屑导航
 * @param string $path 当前路径
 * @return array 面包屑数组 [['name' => string, 'path' => string], ...]
 */
function generateBreadcrumbs($path) {
    $breadcrumbs = [];
    
    // 根目录
    $breadcrumbs[] = [
        'name' => '根目录',
        'path' => ''
    ];
    
    // 如果路径为空，只返回根目录
    if (empty($path)) {
        return $breadcrumbs;
    }
    
    // 分割路径
    $parts = explode('/', $path);
    $currentPath = '';
    
    foreach ($parts as $part) {
        if (!empty($part)) {
            $currentPath .= ($currentPath === '' ? '' : '/') . $part;
            $breadcrumbs[] = [
                'name' => $part,
                'path' => $currentPath
            ];
        }
    }
    
    return $breadcrumbs;
}

/**
 * 创建文件夹
 * @param string $dataFile 数据文件路径
 * @param string $folderName 文件夹名称
 * @param string $parentPath 父文件夹路径（空字符串表示根目录）
 * @param string $createdBy 创建者
 * @return array ['success' => bool, 'message' => string, 'folder' => array]
 */
function createFolder($dataFile, $folderName, $parentPath = '', $createdBy = '') {
    // 验证文件夹名称
    $validation = validateFolderName($folderName);
    if (!$validation['valid']) {
        return [
            'success' => false,
            'message' => $validation['message']
        ];
    }
    
    // 读取数据文件
    $data = safeReadJSON($dataFile, []);
    
    // 确保folders字段存在
    if (!isset($data['folders'])) {
        $data['folders'] = [];
    }
    
    // 构建完整路径
    $fullPath = empty($parentPath) ? $folderName : $parentPath . '/' . $folderName;
    
    // 检查重复
    if (folderExists($data, $fullPath)) {
        return [
            'success' => false,
            'message' => '该文件夹名称已存在'
        ];
    }
    
    // 创建文件夹对象
    $folder = [
        'id' => 'folder_' . uniqid() . '_' . time(),
        'name' => $folderName,
        'path' => $fullPath,
        'parent_path' => $parentPath,
        'created_at' => date('Y-m-d H:i:s'),
        'created_by' => $createdBy
    ];
    
    // 添加到数据结构
    $data['folders'][] = $folder;
    
    // 保存到文件
    if (!safeWriteJSON($dataFile, $data)) {
        return [
            'success' => false,
            'message' => '保存失败，请重试'
        ];
    }
    
    return [
        'success' => true,
        'message' => '文件夹创建成功',
        'folder' => $folder
    ];
}

/**
 * 获取文件夹内容
 * @param string $dataFile 数据文件路径
 * @param string $path 当前路径（空字符串表示根目录）
 * @return array ['folders' => array, 'files' => array]
 */
function getFolderContents($dataFile, $path = '') {
    // 读取数据文件
    $data = safeReadJSON($dataFile, []);
    
    $result = [
        'folders' => [],
        'files' => []
    ];
    
    // 获取子文件夹
    if (isset($data['folders']) && is_array($data['folders'])) {
        foreach ($data['folders'] as $folder) {
            if (isset($folder['parent_path']) && $folder['parent_path'] === $path) {
                $result['folders'][] = $folder;
            }
        }
    }
    
    // 获取文件（支持files或photos字段）
    $fileFields = ['files', 'photos'];
    foreach ($fileFields as $field) {
        if (isset($data[$field]) && is_array($data[$field])) {
            foreach ($data[$field] as $file) {
                $fileFolderPath = isset($file['folder_path']) ? $file['folder_path'] : '';
                if ($fileFolderPath === $path) {
                    $result['files'][] = $file;
                }
            }
        }
    }
    
    return $result;
}

/**
 * 重命名文件夹
 * @param string $dataFile 数据文件路径
 * @param string $oldPath 旧路径
 * @param string $newName 新名称
 * @return array ['success' => bool, 'message' => string]
 */
function renameFolder($dataFile, $oldPath, $newName) {
    // 验证新名称
    $validation = validateFolderName($newName);
    if (!$validation['valid']) {
        return [
            'success' => false,
            'message' => $validation['message']
        ];
    }
    
    // 读取数据文件
    $data = safeReadJSON($dataFile, []);
    
    // 确保folders字段存在
    if (!isset($data['folders']) || !is_array($data['folders'])) {
        return [
            'success' => false,
            'message' => '文件夹不存在'
        ];
    }
    
    // 查找要重命名的文件夹
    $folderIndex = -1;
    $folder = null;
    foreach ($data['folders'] as $index => $f) {
        if ($f['path'] === $oldPath) {
            $folderIndex = $index;
            $folder = $f;
            break;
        }
    }
    
    if ($folderIndex === -1) {
        return [
            'success' => false,
            'message' => '文件夹不存在'
        ];
    }
    
    // 构建新路径
    $parentPath = $folder['parent_path'];
    $newPath = empty($parentPath) ? $newName : $parentPath . '/' . $newName;
    
    // 检查新路径是否已存在
    if ($newPath !== $oldPath && folderExists($data, $newPath)) {
        return [
            'success' => false,
            'message' => '该文件夹名称已存在'
        ];
    }
    
    // 更新文件夹记录
    $data['folders'][$folderIndex]['name'] = $newName;
    $data['folders'][$folderIndex]['path'] = $newPath;
    
    // 更新所有子文件夹的路径
    foreach ($data['folders'] as $index => $f) {
        if (strpos($f['path'], $oldPath . '/') === 0) {
            $data['folders'][$index]['path'] = str_replace($oldPath . '/', $newPath . '/', $f['path']);
            $data['folders'][$index]['parent_path'] = str_replace($oldPath, $newPath, $f['parent_path']);
        }
    }
    
    // 更新所有文件的folder_path
    $fileFields = ['files', 'photos'];
    foreach ($fileFields as $field) {
        if (isset($data[$field]) && is_array($data[$field])) {
            foreach ($data[$field] as $index => $file) {
                $fileFolderPath = isset($file['folder_path']) ? $file['folder_path'] : '';
                if ($fileFolderPath === $oldPath) {
                    $data[$field][$index]['folder_path'] = $newPath;
                } elseif (strpos($fileFolderPath, $oldPath . '/') === 0) {
                    $data[$field][$index]['folder_path'] = str_replace($oldPath . '/', $newPath . '/', $fileFolderPath);
                }
            }
        }
    }
    
    // 保存到文件
    if (!safeWriteJSON($dataFile, $data)) {
        return [
            'success' => false,
            'message' => '保存失败，请重试'
        ];
    }
    
    return [
        'success' => true,
        'message' => '文件夹重命名成功'
    ];
}

/**
 * 删除文件夹
 * @param string $dataFile 数据文件路径
 * @param string $folderPath 文件夹路径
 * @return array ['success' => bool, 'message' => string, 'deletedCount' => int]
 */
function deleteFolder($dataFile, $folderPath) {
    // 读取数据文件
    $data = safeReadJSON($dataFile, []);
    
    // 确保folders字段存在
    if (!isset($data['folders']) || !is_array($data['folders'])) {
        return [
            'success' => false,
            'message' => '文件夹不存在',
            'deletedCount' => 0
        ];
    }
    
    $deletedCount = 0;
    
    // 收集要删除的文件夹路径（包括子文件夹）
    $foldersToDelete = [$folderPath];
    foreach ($data['folders'] as $folder) {
        if (strpos($folder['path'], $folderPath . '/') === 0) {
            $foldersToDelete[] = $folder['path'];
        }
    }
    
    // 删除文件夹
    $data['folders'] = array_values(array_filter($data['folders'], function($folder) use ($foldersToDelete, &$deletedCount) {
        if (in_array($folder['path'], $foldersToDelete)) {
            $deletedCount++;
            return false;
        }
        return true;
    }));
    
    // 删除文件夹中的文件
    $fileFields = ['files', 'photos'];
    foreach ($fileFields as $field) {
        if (isset($data[$field]) && is_array($data[$field])) {
            $data[$field] = array_values(array_filter($data[$field], function($file) use ($foldersToDelete, &$deletedCount) {
                $fileFolderPath = isset($file['folder_path']) ? $file['folder_path'] : '';
                if (in_array($fileFolderPath, $foldersToDelete)) {
                    $deletedCount++;
                    return false;
                }
                return true;
            }));
        }
    }
    
    // 保存到文件
    if (!safeWriteJSON($dataFile, $data)) {
        return [
            'success' => false,
            'message' => '保存失败，请重试',
            'deletedCount' => 0
        ];
    }
    
    return [
        'success' => true,
        'message' => '文件夹删除成功',
        'deletedCount' => $deletedCount
    ];
}

/**
 * 移动文件到文件夹
 * @param string $dataFile 数据文件路径
 * @param string $fileId 文件ID
 * @param string $targetPath 目标文件夹路径
 * @return array ['success' => bool, 'message' => string]
 */
function moveFileToFolder($dataFile, $fileId, $targetPath) {
    // 读取数据文件
    $data = safeReadJSON($dataFile, []);
    
    // 如果目标路径不为空，验证文件夹是否存在
    if (!empty($targetPath) && !folderExists($data, $targetPath)) {
        return [
            'success' => false,
            'message' => '目标文件夹不存在'
        ];
    }
    
    // 查找并更新文件
    $fileFields = ['files', 'photos'];
    $found = false;
    
    foreach ($fileFields as $field) {
        if (isset($data[$field]) && is_array($data[$field])) {
            foreach ($data[$field] as $index => $file) {
                if ($file['id'] === $fileId) {
                    $data[$field][$index]['folder_path'] = $targetPath;
                    $found = true;
                    break 2;
                }
            }
        }
    }
    
    if (!$found) {
        return [
            'success' => false,
            'message' => '文件不存在'
        ];
    }
    
    // 保存到文件
    if (!safeWriteJSON($dataFile, $data)) {
        return [
            'success' => false,
            'message' => '保存失败，请重试'
        ];
    }
    
    return [
        'success' => true,
        'message' => '文件移动成功'
    ];
}


/**
 * 验证文件夹数据结构
 * @param array $data 要验证的数据
 * @return array 验证结果 ['valid' => bool, 'errors' => array]
 */
function validateFolderStructure($data) {
    $errors = [];
    
    // 检查基本结构
    if (!is_array($data)) {
        $errors[] = '数据必须是数组';
        return ['valid' => false, 'errors' => $errors];
    }
    
    // 检查必需的顶级键
    $requiredKeys = ['folders'];
    foreach ($requiredKeys as $key) {
        if (!isset($data[$key])) {
            $errors[] = "缺少必需的键: {$key}";
        } elseif (!is_array($data[$key])) {
            $errors[] = "键 {$key} 必须是数组";
        }
    }
    
    // 验证文件夹结构
    if (isset($data['folders']) && is_array($data['folders'])) {
        foreach ($data['folders'] as $index => $folder) {
            if (!is_array($folder)) {
                $errors[] = "文件夹 #{$index} 必须是数组";
                continue;
            }
            
            // 检查必需的文件夹字段
            $requiredFolderFields = ['id', 'name', 'path'];
            foreach ($requiredFolderFields as $field) {
                if (!isset($folder[$field])) {
                    $errors[] = "文件夹 #{$index} 缺少必需字段: {$field}";
                }
            }
            
            // 验证文件夹名称
            if (isset($folder['name'])) {
                $validation = validateFolderName($folder['name']);
                if (!$validation['valid']) {
                    $errors[] = "文件夹 #{$index} 名称无效: " . $validation['message'];
                }
            }
        }
    }
    
    // 验证文件结构（如果存在）
    $fileFields = ['files', 'photos'];
    foreach ($fileFields as $field) {
        if (isset($data[$field]) && is_array($data[$field])) {
            foreach ($data[$field] as $index => $file) {
                if (!is_array($file)) {
                    $errors[] = "{$field} #{$index} 必须是数组";
                    continue;
                }
                
                // 检查必需的文件字段
                if (!isset($file['id'])) {
                    $errors[] = "{$field} #{$index} 缺少必需字段: id";
                }
                
                // folder_path 字段应该存在（可以为空字符串）
                if (!array_key_exists('folder_path', $file)) {
                    $errors[] = "{$field} #{$index} 缺少 folder_path 字段";
                }
            }
        }
    }
    
    return [
        'valid' => empty($errors),
        'errors' => $errors
    ];
}

/**
 * 验证引用完整性
 * 确保所有文件的 folder_path 都指向存在的文件夹
 * @param array $data 要验证的数据
 * @return array 验证结果 ['valid' => bool, 'errors' => array]
 */
function validateReferentialIntegrity($data) {
    $errors = [];
    
    if (!is_array($data)) {
        return ['valid' => false, 'errors' => ['数据必须是数组']];
    }
    
    // 构建有效文件夹路径集合
    $validPaths = [''];  // 根目录总是有效的
    if (isset($data['folders']) && is_array($data['folders'])) {
        foreach ($data['folders'] as $folder) {
            if (isset($folder['path'])) {
                $validPaths[] = $folder['path'];
            }
        }
    }
    
    // 检查所有文件的 folder_path
    $fileFields = ['files', 'photos'];
    foreach ($fileFields as $field) {
        if (isset($data[$field]) && is_array($data[$field])) {
            foreach ($data[$field] as $index => $file) {
                if (isset($file['folder_path'])) {
                    $folderPath = $file['folder_path'];
                    if ($folderPath !== '' && !in_array($folderPath, $validPaths)) {
                        $fileId = $file['id'] ?? "#{$index}";
                        $errors[] = "{$field} {$fileId} 引用了不存在的文件夹: {$folderPath}";
                    }
                }
            }
        }
    }
    
    return [
        'valid' => empty($errors),
        'errors' => $errors
    ];
}
