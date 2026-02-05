<?php
/**
 * 商城管理辅助函数
 * 管理商品、处理购买、搜索和筛选
 */

require_once __DIR__ . '/json-helper.php';
require_once __DIR__ . '/currency-helper.php';

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

// 商品数据文件路径
define('PRODUCTS_FILE', __DIR__ . '/../data/products.json');
define('ORDERS_FILE', __DIR__ . '/../data/orders.json');

/**
 * 获取所有商品
 * @return array 商品列表
 */
function getAllProducts() {
    $data = safeReadJSON(PRODUCTS_FILE, ['products' => []]);
    return $data['products'];
}

/**
 * 搜索商品
 * @param string $keyword 搜索关键词
 * @return array 匹配的商品列表
 */
function searchProducts($keyword) {
    $products = getAllProducts();
    
    if (empty($keyword)) {
        return $products;
    }
    
    $keyword = strtolower($keyword);
    
    return array_filter($products, function($product) use ($keyword) {
        $name = strtolower($product['name']);
        $description = strtolower($product['description']);
        
        return strpos($name, $keyword) !== false || strpos($description, $keyword) !== false;
    });
}

/**
 * 按分类筛选
 * @param string $category 分类（virtual或physical）
 * @return array 匹配的商品列表
 */
function filterByCategory($category) {
    $products = getAllProducts();
    
    return array_filter($products, function($product) use ($category) {
        return $product['category'] === $category;
    });
}

/**
 * 按价格筛选
 * @param int $minPrice 最低价格
 * @param int $maxPrice 最高价格
 * @return array 匹配的商品列表
 */
function filterByPrice($minPrice, $maxPrice) {
    $products = getAllProducts();
    
    return array_filter($products, function($product) use ($minPrice, $maxPrice) {
        return $product['price'] >= $minPrice && $product['price'] <= $maxPrice;
    });
}

/**
 * 获取商品详情
 * @param string $productId 商品ID
 * @return array|null 商品详情
 */
function getProductDetails($productId) {
    $products = getAllProducts();
    
    foreach ($products as $product) {
        if ($product['id'] === $productId) {
            return $product;
        }
    }
    
    return null;
}

/**
 * 购买商品
 * @param string $userId 用户ID
 * @param string $productId 商品ID
 * @return array 购买结果
 */
function purchaseProduct($userId, $productId) {
    // 获取商品信息
    $product = getProductDetails($productId);
    
    if ($product === null) {
        return [
            'success' => false,
            'message' => '商品不存在'
        ];
    }
    
    // 检查库存
    if ($product['stock'] <= 0) {
        return [
            'success' => false,
            'message' => '商品已售罄'
        ];
    }
    
    // 计算折扣后的价格
    $priceInfo = calculateDiscountPrice($product['price']);
    $finalPrice = $priceInfo['final_price'];
    
    // 检查余额
    if (!hasEnoughBalance($userId, $finalPrice)) {
        return [
            'success' => false,
            'message' => '爱心币不足'
        ];
    }
    
    // 构建购买描述
    $description = "购买商品：{$product['name']}";
    if ($priceInfo['is_special']) {
        $description .= "（{$priceInfo['reason']}特惠，原价{$priceInfo['original_price']}，实付{$finalPrice}）";
    }
    
    // 扣除余额
    if (!deductBalance($userId, $finalPrice, 'purchase', $description)) {
        return [
            'success' => false,
            'message' => '扣款失败'
        ];
    }
    
    // 减少库存
    if (!decreaseStock($productId)) {
        // 扣款成功但库存减少失败，需要退款
        addBalance($userId, $finalPrice, 'refund', "购买失败退款：{$product['name']}");
        return [
            'success' => false,
            'message' => '库存更新失败'
        ];
    }
    
    // 创建订单
    require_once __DIR__ . '/order-helper.php';
    $order = createOrder($userId, $productId, $finalPrice);
    
    if ($order === null) {
        // 订单创建失败，退款并恢复库存
        addBalance($userId, $finalPrice, 'refund', "购买失败退款：{$product['name']}");
        increaseStock($productId);
        return [
            'success' => false,
            'message' => '订单创建失败'
        ];
    }
    
    // 如果是虚拟商品，创建虚拟商品记录
    if ($product['category'] === 'virtual') {
        require_once __DIR__ . '/virtual-item-helper.php';
        createVirtualItem($userId, $productId, $product['name'], $order['id']);
    }
    
    return [
        'success' => true,
        'message' => '购买成功',
        'order_id' => $order['id'],
        'product' => $product
    ];
}

/**
 * 减少库存
 * @param string $productId 商品ID
 * @param int $quantity 数量
 * @return bool 是否成功
 */
function decreaseStock($productId, $quantity = 1) {
    $data = safeReadJSON(PRODUCTS_FILE, ['products' => []]);
    
    $productIndex = -1;
    foreach ($data['products'] as $index => $product) {
        if ($product['id'] === $productId) {
            $productIndex = $index;
            break;
        }
    }
    
    if ($productIndex === -1) {
        return false;
    }
    
    // 检查库存
    if ($data['products'][$productIndex]['stock'] < $quantity) {
        return false;
    }
    
    // 减少库存，增加销量
    $data['products'][$productIndex]['stock'] -= $quantity;
    $data['products'][$productIndex]['sales'] += $quantity;
    
    return safeWriteJSON(PRODUCTS_FILE, $data);
}

/**
 * 增加库存（用于退款等情况）
 * @param string $productId 商品ID
 * @param int $quantity 数量
 * @return bool 是否成功
 */
function increaseStock($productId, $quantity = 1) {
    $data = safeReadJSON(PRODUCTS_FILE, ['products' => []]);
    
    $productIndex = -1;
    foreach ($data['products'] as $index => $product) {
        if ($product['id'] === $productId) {
            $productIndex = $index;
            break;
        }
    }
    
    if ($productIndex === -1) {
        return false;
    }
    
    // 增加库存，减少销量
    $data['products'][$productIndex]['stock'] += $quantity;
    $data['products'][$productIndex]['sales'] -= $quantity;
    
    return safeWriteJSON(PRODUCTS_FILE, $data);
}

/**
 * 更新商品评分
 * @param string $productId 商品ID
 * @param float $newRating 新评分
 * @param int $reviewCount 评价数量
 * @return bool 是否成功
 */
function updateProductRating($productId, $newRating, $reviewCount) {
    $data = safeReadJSON(PRODUCTS_FILE, ['products' => []]);
    
    $productIndex = -1;
    foreach ($data['products'] as $index => $product) {
        if ($product['id'] === $productId) {
            $productIndex = $index;
            break;
        }
    }
    
    if ($productIndex === -1) {
        return false;
    }
    
    $data['products'][$productIndex]['rating'] = $newRating;
    $data['products'][$productIndex]['review_count'] = $reviewCount;
    
    return safeWriteJSON(PRODUCTS_FILE, $data);
}

/**
 * 组合筛选
 * @param array $filters 筛选条件
 * @return array 匹配的商品列表
 */
function filterProducts($filters) {
    $products = getAllProducts();
    
    // 搜索关键词
    if (isset($filters['keyword']) && !empty($filters['keyword'])) {
        $keyword = strtolower($filters['keyword']);
        $products = array_filter($products, function($product) use ($keyword) {
            $name = strtolower($product['name']);
            $description = strtolower($product['description']);
            return strpos($name, $keyword) !== false || strpos($description, $keyword) !== false;
        });
    }
    
    // 分类筛选
    if (isset($filters['category']) && !empty($filters['category'])) {
        $products = array_filter($products, function($product) use ($filters) {
            return $product['category'] === $filters['category'];
        });
    }
    
    // 价格筛选
    if (isset($filters['min_price'])) {
        $products = array_filter($products, function($product) use ($filters) {
            return $product['price'] >= $filters['min_price'];
        });
    }
    
    if (isset($filters['max_price'])) {
        $products = array_filter($products, function($product) use ($filters) {
            return $product['price'] <= $filters['max_price'];
        });
    }
    
    return array_values($products);
}

/**
 * 获取商品统计
 * @return array 统计信息
 */
function getProductStats() {
    $products = getAllProducts();
    
    $stats = [
        'total' => count($products),
        'virtual' => 0,
        'physical' => 0,
        'in_stock' => 0,
        'out_of_stock' => 0,
        'total_sales' => 0
    ];
    
    foreach ($products as $product) {
        if ($product['category'] === 'virtual') {
            $stats['virtual']++;
        } else {
            $stats['physical']++;
        }
        
        if ($product['stock'] > 0) {
            $stats['in_stock']++;
        } else {
            $stats['out_of_stock']++;
        }
        
        $stats['total_sales'] += $product['sales'];
    }
    
    return $stats;
}

/**
 * 检查今天是否是特殊日期（纪念日或生日）
 * @return array 包含 is_special, discount, reason
 */
function checkSpecialDate() {
    $configFile = __DIR__ . '/../data/config.json';
    $config = safeReadJSON($configFile, []);
    
    $today = date('m-d');
    
    // 检查 specialDates 配置
    if (isset($config['specialDates'])) {
        $specialDates = $config['specialDates'];
        
        // 检查是否是恋爱纪念日
        if (isset($specialDates['anniversary']) && $specialDates['anniversary']['date'] === $today) {
            return [
                'is_special' => true,
                'discount' => $specialDates['anniversary']['discount'],
                'reason' => $specialDates['anniversary']['name']
            ];
        }
        
        // 检查 specialDates.birthdays 数组
        if (isset($specialDates['birthdays'])) {
            foreach ($specialDates['birthdays'] as $birthday) {
                if ($birthday['date'] === $today) {
                    return [
                        'is_special' => true,
                        'discount' => $birthday['discount'],
                        'reason' => $birthday['name']
                    ];
                }
            }
        }
    }
    
    // 检查 users 下的 birthday（作为备用）
    if (isset($config['users'])) {
        foreach ($config['users'] as $userName => $userInfo) {
            if (isset($userInfo['birthday']) && $userInfo['birthday'] === $today) {
                return [
                    'is_special' => true,
                    'discount' => 0.6, // 默认6折
                    'reason' => "{$userName}的生日"
                ];
            }
        }
    }
    
    return [
        'is_special' => false,
        'discount' => 1.0,
        'reason' => ''
    ];
}

/**
 * 计算商品折扣后价格
 * @param int $originalPrice 原价
 * @return array 包含 final_price, discount, is_special, reason
 */
function calculateDiscountPrice($originalPrice) {
    $specialDate = checkSpecialDate();
    
    if ($specialDate['is_special']) {
        $finalPrice = (int)round($originalPrice * $specialDate['discount']);
        return [
            'final_price' => $finalPrice,
            'original_price' => $originalPrice,
            'discount' => $specialDate['discount'],
            'discount_percent' => (int)($specialDate['discount'] * 100),
            'saved' => $originalPrice - $finalPrice,
            'is_special' => true,
            'reason' => $specialDate['reason']
        ];
    }
    
    return [
        'final_price' => $originalPrice,
        'original_price' => $originalPrice,
        'discount' => 1.0,
        'discount_percent' => 100,
        'saved' => 0,
        'is_special' => false,
        'reason' => ''
    ];
}

/**
 * 获取所有商品（带折扣信息）
 * @return array 商品列表
 */
function getAllProductsWithDiscount() {
    $products = getAllProducts();
    
    foreach ($products as &$product) {
        $priceInfo = calculateDiscountPrice($product['price']);
        $product['price_info'] = $priceInfo;
        $product['display_price'] = $priceInfo['final_price'];
    }
    
    return $products;
}
