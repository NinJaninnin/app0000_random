// ==========================================
// 랜덤 뽑기판 웹앱 핵심 로직 (순수 JavaScript)
// ==========================================

// --- [DOM 요소 참조] ---
const DOM = {
    board: document.getElementById('board'),
    prizeListContainer: document.getElementById('prize-list-container'),
    btnAddPrize: document.getElementById('btn-add-prize'),
    btnApply: document.getElementById('btn-apply'),
    btnReset: document.getElementById('btn-reset'),
    statusList: document.getElementById('status-list'),
    bgThumbs: document.querySelectorAll('.bg-thumb'),
    boxThumbs: document.querySelectorAll('.box-thumb'), // 커스텀 박스 썸네일 추가
    broadcastPanel: document.getElementById('broadcast-panel'),
    adModal: document.getElementById('ad-modal'),       // 전면 광고 모달 추가
    adVideo: document.getElementById('ad-video'),       // 광고 비디오 태그 추가
    btnSkipAd: document.getElementById('btn-skip-ad')   // 광고 닫기 버튼
};

// --- [상태 변수(State)] ---
let currentTilesData = [];       // 현재 생성된 전제 타일 데이터
let totalBoardSize = 25;         // 보드 크기 기본값
let remainingPrizes = {};        // { "상품명": 남은수량 } 객체
let isSettingComplete = false;   // 설정 완료 플래그

// (신규 추가된 상태 변수)
let customBoxImage = 'none';     // 현재 선택된 박스 이미지 URL 상태
let drawCount = 0;               // 사용자가 클릭해서 타일을 깐(뽑기) 횟수 추적
let adTimeout = null;            // 광고 재생 타이머 아이디
let currentFlipCallback = null;  // 광고 종료 후 실행해야 할 실제 타일 뒤집기 함수 객체 보관용

// --- [이벤트 리스너 등록] ---
function bindEvents() {
    DOM.btnAddPrize.addEventListener('click', addPrizeRow);
    DOM.btnApply.addEventListener('click', applySettings);
    DOM.btnReset.addEventListener('click', resetBoard);

    // 배경 이미지 썸네일 클릭 이벤트
    DOM.bgThumbs.forEach(thumb => {
        thumb.addEventListener('click', (e) => changeBackground(e.currentTarget));
    });

    // 박스(타일 앞면) 이미지 썸네일 클릭 이벤트
    DOM.boxThumbs.forEach(thumb => {
        thumb.addEventListener('click', (e) => changeBoxImage(e.currentTarget));
    });

    // 전면 광고 스킵(강제 닫기) 이벤트
    if (DOM.btnSkipAd) {
        DOM.btnSkipAd.addEventListener('click', closeAdModal);
    }
}

// --- [동적 UI 제어 함수] ---

/**
 * [상품 목록 추가] 버튼 클릭 시
 */
function addPrizeRow() {
    const row = document.createElement('div');
    row.className = 'prize-row';
    row.innerHTML = `
        <input type="text" class="prize-name" placeholder="상품명 (예: 치킨 기프티콘)">
        <input type="number" class="prize-count" placeholder="수량" min="1" value="1">
        <button class="btn-remove" onclick="removePrizeRow(this)">X</button>
    `;
    DOM.prizeListContainer.appendChild(row);
}

/**
 * 전역 [X] 삭제 함수
 */
window.removePrizeRow = function(btn) {
    const row = btn.parentElement;
    if (DOM.prizeListContainer.children.length > 1) {
        DOM.prizeListContainer.removeChild(row);
    } else {
        alert("최소 1개의 항목은 필요합니다.");
    }
};

/**
 * 방송 패널의 배경 이미지를 교체
 * @param {HTMLElement} targetThumb - 클릭된 요소
 */
function changeBackground(targetThumb) {
    DOM.bgThumbs.forEach(t => t.classList.remove('active'));
    targetThumb.classList.add('active');

    const bgUrl = targetThumb.getAttribute('data-bg');
    if (bgUrl === 'none') {
        DOM.broadcastPanel.style.backgroundImage = 'none';
    } else {
        DOM.broadcastPanel.style.backgroundImage = `url('${bgUrl}')`;
    }
}

/**
 * 타일(박스) 앞면 커스텀 이미지를 교체
 * @param {HTMLElement} targetThumb - 클릭된 박스 영역 요소
 */
function changeBoxImage(targetThumb) {
    // 1. 모든 active 초기화 후 클릭된 타겟 활성화
    DOM.boxThumbs.forEach(t => t.classList.remove('active'));
    targetThumb.classList.add('active');

    // 2. URL 추출하여 상태에 저장
    const boxUrl = targetThumb.getAttribute('data-box');
    customBoxImage = boxUrl;
    
    // 3. 만약 이미 렌더링된 보드가 있다면 즉시 스타일(background-image)을 업데이트 해준다.
    const allTileFronts = document.querySelectorAll('.tile-front');
    allTileFronts.forEach(front => {
        if (boxUrl === 'none') {
            // 초기화 시엔 기본 그라데이션 복구
            front.style.backgroundImage = 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(0,0,0,0.3))';
        } else {
            // 커스텀 박스 사진 적용
            front.style.backgroundImage = `url('${boxUrl}')`;
        }
    });
}


// --- [핵심 로직: 데이터 세팅 및 배열 섞기] ---

function applySettings() {
    const selectedSizeRadio = document.querySelector('input[name="boardSize"]:checked');
    totalBoardSize = parseInt(selectedSizeRadio.value, 10);

    const prizeRows = document.querySelectorAll('.prize-row');
    let totalPrizeCount = 0;
    const parsedPrizes = [];
    remainingPrizes = {};

    prizeRows.forEach(row => {
        const nameInput = row.querySelector('.prize-name').value.trim();
        const countInput = parseInt(row.querySelector('.prize-count').value, 10);

        if (nameInput && !isNaN(countInput) && countInput > 0) {
            totalPrizeCount += countInput;
            parsedPrizes.push({ name: nameInput, count: countInput });
            
            if (remainingPrizes[nameInput]) {
                remainingPrizes[nameInput] += countInput;
            } else {
                remainingPrizes[nameInput] = countInput;
            }
        }
    });

    if (totalPrizeCount > totalBoardSize) {
        alert(`입력하신 상품의 총합(${totalPrizeCount}개)이 선택하신 보드 크기(${totalBoardSize}칸)를 초과했습니다!\n수량을 줄이거나 보드 크기를 키워주세요.`);
        return; 
    }

    currentTilesData = [];

    parsedPrizes.forEach(prize => {
        for (let i = 0; i < prize.count; i++) {
            currentTilesData.push({ type: 'prize', name: prize.name });
        }
    });

    const bustCount = totalBoardSize - totalPrizeCount;
    for (let i = 0; i < bustCount; i++) {
        currentTilesData.push({ type: 'bust', name: '꽝' });
    }

    shuffleArray(currentTilesData);
    renderBoard();
    updateStatusBoard();

    isSettingComplete = true;
    
    // 새로 섞을 경우 뽑기 카운트 초기화
    drawCount = 0;

    DOM.board.classList.remove('shuffling');
    void DOM.board.offsetWidth; 
    DOM.board.classList.add('shuffling');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- [보드 렌더링 및 클릭 이벤트] ---

function renderBoard() {
    DOM.board.innerHTML = '';

    let columns = 5;
    if (totalBoardSize === 50) columns = 10;
    if (totalBoardSize === 100) columns = 10;
    
    DOM.board.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    currentTilesData.forEach((tileData, index) => {
        const tileWrapper = document.createElement('div');
        tileWrapper.className = 'tile';
        tileWrapper.dataset.index = index;
        
        const backClass = tileData.type === 'prize' ? 'prize' : 'bust';

        // 앞면 렌더링 시 현재 저장된 커스텀 박스 이미지가 있다면 인라인 스타일로 넣어줌
        let frontStyle = "";
        if(customBoxImage !== 'none') {
            frontStyle = `style="background-image: url('${customBoxImage}');"`;
        }

        // 3D Flip 처리를 위한 구조 (커스텀 배경 주입)
        tileWrapper.innerHTML = `
            <div class="tile-inner">
                <div class="tile-front" ${frontStyle}>${index + 1}</div>
                <div class="tile-back ${backClass}">${tileData.name}</div>
            </div>
        `;

        tileWrapper.addEventListener('click', handleTileClick);
        DOM.board.appendChild(tileWrapper);
    });
}

/**
 * 타일(박스) 클릭 시 연출 및 광고 호출 체인
 */
function handleTileClick(e) {
    if (!isSettingComplete) return;

    const tileWrapper = e.currentTarget;
    if (tileWrapper.classList.contains('flipped')) return;

    // 실제 타일 뒤집기 및 현황판 데이터 연산을 담당하는 내부 콜백 함수
    const executeFlip = () => {
        tileWrapper.classList.add('flipped');

        const index = tileWrapper.dataset.index;
        const tileData = currentTilesData[index];

        if (tileData.type === 'prize') {
            if (remainingPrizes[tileData.name] > 0) {
                remainingPrizes[tileData.name]--;
                updateStatusBoard();
            }
        }
    };

    // 1. 뽑기 클릭 횟수 1 증가
    drawCount++;

    // 2. 카운트가 10의 배수 (10, 20, 30...) 일 경우 전면 광고 띄우기 수행
    if (drawCount % 10 === 0) {
        showVideoAd(executeFlip);
    } else {
        // 아니면 원래 하던 대로 즉시 타일 뒤집기
        executeFlip();
    }
}

// --- [수익화(광고) 관련 함수] ---

/**
 * 동영상 전면 모달 광고 표출 함수
 * 15초(15000ms) 동안 강제로 재생 후 지정된 콜백(타일 결과보여주기)을 실행합니다.
 * @param {Function} onCompleteCallback - 광고 시청 완료 후 실행할 함수
 */
function showVideoAd(onCompleteCallback) {
    currentFlipCallback = onCompleteCallback;
    
    // 모달 활성화 및 초기화
    DOM.adModal.classList.remove('hidden');
    DOM.adVideo.currentTime = 0; // 영상 처음부터
    
    // 비디오 재생 시도
    // (크롬 등에서 자동재생 정책에 의해 에러가 날수도 있으므로 catch 블록 처리 필요)
    DOM.adVideo.play().catch(e => {
        console.warn("비디오 재생이 차단되었거나 파일이 없습니다. 그래도 15초 후 닫힙니다.", e);
    });

    // 15초 후 자동으로 광고를 닫고 뽑기 결과를 표출하도록 타이머 설정
    adTimeout = setTimeout(() => {
        closeAdModal();
    }, 15000);
}

/**
 * 광고 모달 닫기 및 보류되었던 콜백 함수 실행
 */
function closeAdModal() {
    // 타이머가 돌고 있다면 해제
    if (adTimeout) clearTimeout(adTimeout);
    
    // 모달 숨김 및 영상 일시정지
    DOM.adModal.classList.add('hidden');
    DOM.adVideo.pause();

    // 혹시 보관된 타일 뒤집기 콜백이 있다면 마저 실행!
    if (currentFlipCallback) {
        currentFlipCallback();
        currentFlipCallback = null; // 메모리 정리
    }
}

// --- [공통 화면 업데이트 함수] ---

function updateStatusBoard() {
    DOM.statusList.innerHTML = ''; 
    let isAllEmpty = true; 
    let hasKeys = false;   

    for (const [name, count] of Object.entries(remainingPrizes)) {
        hasKeys = true;
        const itemSpan = document.createElement('span');
        itemSpan.className = 'status-item';
        
        if (count === 0) {
            itemSpan.classList.add('empty'); 
        } else {
            isAllEmpty = false;
        }

        itemSpan.innerHTML = `${name} <span class="count">${count}개</span>`;
        DOM.statusList.appendChild(itemSpan);
    }

    if (!hasKeys) {
        DOM.statusList.innerHTML = `<span class="status-empty">설정된 상품이 없습니다. 100% 꽝입니다!</span>`;
    } else if (isAllEmpty) {
        const finishMsg = document.createElement('span');
        finishMsg.style.color = '#ff4d4d'; 
        finishMsg.style.fontWeight = 'bold';
        finishMsg.textContent = "🎉 모든 상품이 소진되었습니다!";
        DOM.statusList.appendChild(finishMsg);
    }
}

function resetBoard() {
    // 빈 상태방어
    if (!DOM.board.innerHTML.trim() || !isSettingComplete) {
        alert("아직 생성된 보드가 없습니다.\n먼저 '설정 완료 및 섞기' 버튼을 눌러주세요.");
        return;
    }

    const confirmReset = confirm("진행 중인 뽑기판을 초기화하시겠습니까?\n(타일이 전부 앞면으로 덮어집니다.)");
    if (!confirmReset) return;

    const allTiles = document.querySelectorAll('.tile');
    allTiles.forEach(t => t.classList.remove('flipped'));

    setTimeout(() => {
        applySettings();
    }, 600);
}

// --- [앱 초기화] ---
window.onload = () => {
    bindEvents();

    // 첫 실행 시 배경을 bg_0000.webp로 기본 적용
    const defaultBgThumb = document.querySelector('.bg-thumb[data-bg="img/bg_0000.webp"]');
    if (defaultBgThumb) {
        changeBackground(defaultBgThumb);
    }
};
