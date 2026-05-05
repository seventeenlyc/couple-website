<?php
/**
 * 商城API
 * 处理商品浏览和购买请求
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/shop-helper.php';

// 初始化会话
initSession();

// 设置响应头
header('Content-Type: application/json; charset=utf-8');

// 检查登录状态
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => '请先登录'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$userId = getCurrentUserId();
$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'get_all':
            // 获取所有商品
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $products = getAllProductsWithDiscount();
            $specialDate = checkSpecialDate();
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'products' => array_values($products),
                'special_date' => $specialDate
            ], JSON_UNESCAPED_UNICODE);
            break;
            
        case 'search':
            // 搜索商品
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $keyword = $_GET['keyword'] ?? '';
            $products = searchProducts($keyword);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'products' => array_values($products),
                'keyword' => $keyword
            ], JSON_UNESCAPED_UNICODE);
            break;
            
        case 'filter':
            // 筛选商品
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $filters = [
                'keyword' => $_GET['keyword'] ?? null,
                'category' => $_GET['category'] ?? null,
                'min_price' => isset($_GET['min_price']) ? (int)$_GET['min_price'] : null,
                'max_price' => isset($_GET['max_price']) ? (int)$_GET['max_price'] : null
            ];
            
            // 移除空值
            $filters = array_filter($filters, function($value) {
                return $value !== null && $value !== '';
            });
            
            $products = filterProducts($filters);

            // 添加折扣信息
            foreach ($products as &$product) {
                $priceInfo = calculateDiscountPrice($product['price']);
                $product['price_info'] = $priceInfo;
                $product['display_price'] = $priceInfo['final_price'];
            }
            unset($product);

            $specialDate = checkSpecialDate();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'products' => array_values($products),
                'filters' => $filters,
                'special_date' => $specialDate
            ], JSON_UNESCAPED_UNICODE);
            break;
            
        case 'get_details':
            // 获取商品详情
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $productId = $_GET['product_id'] ?? '';
            
            if (empty($productId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少商品ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $product = getProductDetails($productId);
            
            if ($product === null) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => '商品不存在'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'product' => $product
            ], JSON_UNESCAPED_UNICODE);
            break;
            
        case 'purchase':
            // 购买商品
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持POST请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $productId = $input['product_id'] ?? '';
            
            if (empty($productId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少商品ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $result = purchaseProduct($userId, $productId);
            
            if ($result['success']) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => '购买成功！',
                    'order_id' => $result['order_id'],
                    'product' => $result['product']
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => $result['message']
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => '无效的操作'
            ], JSON_UNESCAPED_UNICODE);
            break;
    }
    
} catch (Exception $e) {
    error_log("商城API错误: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => '服务器错误，请稍后重试'
    ], JSON_UNESCAPED_UNICODE);
}
