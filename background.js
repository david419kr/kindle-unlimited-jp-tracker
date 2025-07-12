// 설치 시 초기화
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('dailyCheck', {
    delayInMinutes: 1,
    periodInMinutes: 24 * 60
  });
});

// 알람 리스너
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyCheck') {
    checkAllBooks();
  }
});

chrome.runtime.onInstalled.addListener(() => { updateBadgeCount(); });
chrome.runtime.onStartup.addListener(() => { updateBadgeCount(); });

// 백그라운드에서 페이지 내용 가져오기
async function fetchPageContent(url) {
  try {
    const response = await fetch(url, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    return html;
  } catch (error) {
    console.error('페이지 가져오기 실패:', error);
    return null;
  }
}

// HTML에서 Kindle Unlimited 상태 확인
function checkKindleUnlimitedFromHTML(html) {
  const kuMessages = [
    "メンバーシップに含まれています。",
    "この本を含む500万冊の電子書籍が読み放題。人気のマンガ、雑誌も豊富",
    "Included with your membership.",
    "Unlimited reading. Over 4 million titles."
  ];
  
  // HTML에서 해당 클래스와 텍스트 찾기
  const kuClassRegex = /class="[^"]*a-size-base[^"]*a-color-secondary[^"]*ku-promo-message[^"]*"[^>]*>([^<]*)</g;
  let match;
  
  while ((match = kuClassRegex.exec(html)) !== null) {
    const text = match[1].trim();
    if (kuMessages.some(message => text.includes(message))) {
      return true;
    }
  }
  
  return false;
}

// 책 제목 추출
function extractBookTitle(html) {
  const titleMatch = html.match(/<span[^>]*id="productTitle"[^>]*>([^<]*)<\/span>/);
  return titleMatch ? titleMatch[1].trim() : '無題';
}

// 모든 등록된 책 확인 (백그라운드 방식)
async function checkAllBooks() {
  const result = await chrome.storage.local.get(['trackedBooks']);
  const trackedBooks = result.trackedBooks || [];
  
  for (let book of trackedBooks) {
    try {
      // 백그라운드에서 페이지 내용 가져오기
      const html = await fetchPageContent(book.url);
      
      if (html) {
        const isKindleUnlimited = checkKindleUnlimitedFromHTML(html);
        const title = extractBookTitle(html) || book.title;
        
        // 상태 변경 확인
        if (isKindleUnlimited && !book.wasKindleUnlimited) {
          // 알림 전송
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'unlimited.png',
            title: 'Kindle Unlimited登録',
            message: `"${title}"がKindle Unlimitedに登録されました。`,
          });
        }
        
        // 상태 업데이트
        book.wasKindleUnlimited = isKindleUnlimited;
        book.isKindleUnlimited = isKindleUnlimited;
        book.title = title;
        book.lastChecked = new Date().toISOString();
      }
      
      // 요청 간격 조절 (Amazon 서버 부하 방지)
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('책 확인 중 오류:', error);
    }
  }
  
  // 업데이트된 정보 저장
  chrome.storage.local.set({trackedBooks: trackedBooks});
  updateBadgeCount();
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveBook') {
    saveBook(message.bookInfo);
  } else if (message.action === 'checkAllBooks') {
    checkAllBooks();
  }
});

// 책 저장 함수
async function saveBook(bookInfo) {
  const result = await chrome.storage.local.get(['trackedBooks']);
  let trackedBooks = result.trackedBooks || [];
  
  const existingIndex = trackedBooks.findIndex(book => book.url === bookInfo.url);
  
  if (existingIndex >= 0) {
    trackedBooks[existingIndex] = {
      ...trackedBooks[existingIndex],
      ...bookInfo,
      wasKindleUnlimited: bookInfo.isKindleUnlimited
    };
  } else {
    trackedBooks.push({
      ...bookInfo,
      wasKindleUnlimited: bookInfo.isKindleUnlimited,
      dateAdded: new Date().toISOString()
    });
  }
  
  await chrome.storage.local.set({trackedBooks: trackedBooks});
  updateBadgeCount();
}

// 뱃지 업데이트 함수
async function updateBadgeCount() {
  const result = await chrome.storage.local.get(['trackedBooks']);
  const trackedBooks = result.trackedBooks || [];
  const count = trackedBooks.filter(book => book.isKindleUnlimited).length;
  const text = count > 0 ? count.toString() : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#4caf50' });
}