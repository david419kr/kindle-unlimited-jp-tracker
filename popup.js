document.addEventListener('DOMContentLoaded', async () => {
  // 현재 페이지 책 추가 버튼
  document.getElementById('addCurrentBook').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tab.url.includes('amazon.co.jp')) {
      alert('Amazon.co.jpでのみ動作します。');
      return;
    }
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'addCurrentBook'
      });
      
      if (response.success) {
        alert(`"${response.bookInfo.title}" 登録されました。`);
        loadBookList();
        chrome.runtime.sendMessage({action: 'updateBadgeCount'});
      }
    } catch (error) {
      alert('現在のページから本を追加できませんでした。');
    }
  });
  
  // 모든 책 확인 버튼
  document.getElementById('checkAll').addEventListener('click', () => {
    chrome.runtime.sendMessage({action: 'checkAllBooks'});
    alert('すべての本を確認します。反映には１分ほどかかる場合があります。\n※このボタンを押さなくても、定期的に自動更新されます。');
    loadBookList();
  });
  
  // 책 목록 로드
  loadBookList();
});

// 책 목록 로드 함수
async function loadBookList() {
  const result = await chrome.storage.local.get(['trackedBooks']);
  const trackedBooks = result.trackedBooks || [];
  
  const bookListElement = document.getElementById('bookList');
  
  if (trackedBooks.length === 0) {
    bookListElement.innerHTML = '<p style="text-align: center; color: #666;">まだ本が登録されていません。</p>';
    return;
  }

  // isKindleUnlimited 상태에 따라 책 목록 정렬. true가 먼저 오도록 정렬
  trackedBooks.sort((a, b) => {
    if (a.isKindleUnlimited && !b.isKindleUnlimited) {
      return -1;
    } else if (!a.isKindleUnlimited && b.isKindleUnlimited) {
      return 1;
    } else {
      return 0;
    }
  });
  
  bookListElement.innerHTML = '';
  
  trackedBooks.forEach((book) => {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book-item';
    
    bookDiv.innerHTML = `
      <button class="remove-btn" data-title="${book.title}">削除</button>
      <div class="book-title" data-url="${book.url}">${book.title}</div>
      <span class="book-status ${book.isKindleUnlimited ? 'ku-available' : 'ku-not-available'}">
        ${book.isKindleUnlimited ? 'Unlimited可' : 'Unlimited不可'}
      </span>
      <div class="book-meta">
        最終確認: ${new Date(book.lastChecked).toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })}
      </div>
    `;
    
    bookListElement.appendChild(bookDiv);
  });
  
  // 삭제 버튼 이벤트 리스너 추가
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const title = e.target.dataset.title; // data-title에서 제목 추출
      await removeBookByTitle(title);
    });
  });
  
  // 책 제목 클릭 이벤트 리스너 추가
  document.querySelectorAll('.book-title').forEach(title => {
    title.addEventListener('click', (e) => {
      const url = e.target.dataset.url;
      chrome.tabs.create({url: url});
    });
  });
}

// 책 제목으로 삭제 함수
async function removeBookByTitle(title) {
  if (!confirm('本当に削除しますか？')) {
    return;
  }
  
  const result = await chrome.storage.local.get(['trackedBooks']);
  let trackedBooks = result.trackedBooks || [];
  
  // 제목이 일치하지 않는 책만 남김
  trackedBooks = trackedBooks.filter(book => book.title !== title);
  
  await chrome.storage.local.set({trackedBooks: trackedBooks});
  loadBookList();
  chrome.runtime.sendMessage({action: 'updateBadgeCount'});
}

