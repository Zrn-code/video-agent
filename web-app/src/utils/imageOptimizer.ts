/**
 * 優化圖片 URL，使用 images.weserv.nl 進行壓縮和調整大小
 * @param url 原始圖片 URL
 * @param width 目標寬度（默認 200px）
 * @param quality 圖片質量 1-100（默認 80）
 * @returns 優化後的圖片 URL
 */
export function optimizeAvatarUrl(url: string, width: number = 200, quality: number = 80): string {
  // 如果是 dicebear 或其他 SVG API，不需要優化
  if (url.includes('dicebear.com') || url.includes('api.dicebear')) {
    return url;
  }
  
  // 如果已經是優化過的 URL，直接返回
  if (url.includes('images.weserv.nl')) {
    return url;
  }
  
  try {
    // 使用 images.weserv.nl 免費圖片優化服務
    // 參數說明：
    // w: 寬度
    // q: 質量 (1-100)
    // output: 輸出格式 (webp 更小)
    // il: 交錯載入
    const encodedUrl = encodeURIComponent(url);
    return `https://images.weserv.nl/?url=${encodedUrl}&w=${width}&q=${quality}&output=webp&il`;
  } catch (e) {
    console.error('Failed to optimize image URL:', e);
    return url;
  }
}

/**
 * 為不同尺寸的頭像優化
 */
export const avatarSizes = {
  thumbnail: 100,  // 縮圖
  small: 200,      // 小尺寸
  medium: 400,     // 中等尺寸
  large: 800       // 大尺寸
};
