// Kindle Unlimited 감지 함수
function detectKindleUnlimited() {
  const kuMessages = [
    "メンバーシップに含まれています。",
    "この本を含む500万冊の電子書籍が読み放題。人気のマンガ、雑誌も豊富",
    "Included with your membership.",
    "Unlimited reading. Over 4 million titles."
  ];
  
  const elements = document.querySelectorAll('.a-size-base.a-color-secondary.ku-promo-message');
  
  for (let element of elements) {
    const text = element.textContent.trim();
    if (kuMessages.some(message => text.includes(message))) {
      return true;
    }
  }
  
  return false;
}

// 책 정보 추출
function getBookInfo() {
  const titleElement = document.querySelector('#productTitle');
  const title = titleElement ? titleElement.textContent.trim() : null;

  if (!title) {
    console.error('책 제목을 찾을 수 없습니다.');
    return null;
  }
  
  return {
    url: window.location.href,
    title: title,
    isKindleUnlimited: detectKindleUnlimited(),
    lastChecked: new Date().toISOString()
  };
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkKindleUnlimited') {
    const bookInfo = getBookInfo();
    sendResponse(bookInfo);
  }
  
  if (request.action === 'addCurrentBook') {
    const bookInfo = getBookInfo();
    chrome.runtime.sendMessage({
      action: 'saveBook',
      bookInfo: bookInfo
    });
    sendResponse({success: true, bookInfo: bookInfo});
  }
});
