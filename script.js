// ==========================================
// 랜덤 뽑기판 웹앱 핵심 로직 (순수 JavaScript)
// ==========================================

// --- [DOM 요소 참조] ---
const DOM = {
    board: document.getElementById('board'),
    prizeListContainer: document.getElementById('prize-list-container'),
    fixedPrizeListContainer: document.getElementById('fixed-prize-list-container'),
    btnAddPrize: document.getElementById('btn-add-prize'),
    btnAddFixedPrize: document.getElementById('btn-add-fixed-prize'),
    btnApply: document.getElementById('btn-apply'),
    btnReset: document.getElementById('btn-reset'),
    bgThumbs: document.querySelectorAll('.bg-thumb'),
    boxThumbs: document.querySelectorAll('.box-thumb'),
    thumbThumbs: document.querySelectorAll('.thumb-thumb'),
    coverThumbs: document.querySelectorAll('.cover-thumb'),
    broadcastPanel: document.getElementById('broadcast-panel'),
    contentWrapper: document.getElementById('content-wrapper'),
    board: document.getElementById('board')
};

// --- [상태 변수(State)] ---
let currentTilesData = [];       // 현재 생성된 전제 타일 데이터
let totalBoardSize = 25;         
let remainingPrizes = {};        
let isSettingComplete = false;   
let customBoxImage = 'none';     
let drawCount = 0;               

// --- [이벤트 리스너 등록] ---
function bindEvents() {
    if(DOM.btnAddPrize) DOM.btnAddPrize.addEventListener('click', addPrizeRow);
    if(DOM.btnAddFixedPrize) DOM.btnAddFixedPrize.addEventListener('click', addFixedPrizeRow);
    DOM.btnApply.addEventListener('click', applySettings);
    DOM.btnReset.addEventListener('click', resetBoard);

    DOM.bgThumbs.forEach(thumb => {
        thumb.addEventListener('click', (e) => changeBackground(e.currentTarget));
    });

    DOM.boxThumbs.forEach(thumb => {
        thumb.addEventListener('click', (e) => changeBoxImage(e.currentTarget));
    });

    if(DOM.thumbThumbs) {
        DOM.thumbThumbs.forEach(thumb => {
            thumb.addEventListener('click', (e) => changeTopThumbnail(e.currentTarget));
        });
    }

    if(DOM.coverThumbs) {
        DOM.coverThumbs.forEach(thumb => {
            thumb.addEventListener('click', (e) => changeBoardCover(e.currentTarget));
        });
    }

    // 다중 창(탭) 실시간 연동 (같은 브라우저 내에서만 동작)
    window.addEventListener('storage', (e) => {
        if (e.key === 'boardSyncState' && e.newValue) {
            try {
                const data = JSON.parse(e.newValue);
                // 1. 뒤집힌 타일 동기화
                if (data.flipped) {
                    document.querySelectorAll('.tile').forEach(t => {
                        const idx = parseInt(t.dataset.index, 10);
                        if (data.flipped.includes(idx)) {
                            t.classList.add('flipped');
                        } else {
                            t.classList.remove('flipped');
                        }
                    });
                }
                // 2. 남은 상품 수량 동기화
                if (data.remaining) {
                    remainingPrizes = data.remaining;
                    if(typeof updateTopPrizeSummary === 'function') updateTopPrizeSummary();
                }
            } catch(err) {
                console.error("동기화 파싱 에러", err);
            }
        }
    });
}

// --- [동적 UI 제어 함수] ---

/**
 * [상품 목록 추가] 버튼 클릭 시
 */
window.switchTab = function(type) {
    document.getElementById('tab-btn-normal').classList.remove('active');
    document.getElementById('tab-btn-fixed').classList.remove('active');
    document.getElementById('tab-normal').classList.remove('active');
    document.getElementById('tab-fixed').classList.remove('active');

    if (type === 'normal') {
        document.getElementById('tab-btn-normal').classList.add('active');
        document.getElementById('tab-normal').classList.add('active');
    } else {
        document.getElementById('tab-btn-fixed').classList.add('active');
        document.getElementById('tab-fixed').classList.add('active');
    }
}

function addPrizeRow() {
    const row = document.createElement('div');
    row.className = 'prize-row';
    row.innerHTML = `
        <input type="text" class="prize-name" placeholder="상품명">
        <input type="number" class="prize-count" placeholder="수량" min="1" value="1">
        <button class="btn-remove" onclick="removePrizeRow(this)">X</button>
    `;
    DOM.prizeListContainer.appendChild(row);
}

function addFixedPrizeRow() {
    if (!DOM.fixedPrizeListContainer) return;
    const row = document.createElement('div');
    row.className = 'prize-row fixed-row';
    row.innerHTML = `
        <input type="text" class="prize-name" placeholder="상품명">
        <input type="text" class="prize-fixed-input" placeholder="지정칸 번호">
        <button class="btn-remove" onclick="removeFixedPrizeRow(this)">X</button>
    `;
    DOM.fixedPrizeListContainer.appendChild(row);
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

window.removeFixedPrizeRow = function(btn) {
    const row = btn.parentElement;
    if (DOM.fixedPrizeListContainer && DOM.fixedPrizeListContainer.children.length > 1) {
        DOM.fixedPrizeListContainer.removeChild(row);
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
        DOM.broadcastPanel.classList.add('no-bg');
    } else {
        DOM.broadcastPanel.style.backgroundImage = `url('${bgUrl}')`;
        DOM.broadcastPanel.classList.remove('no-bg');
    }
}

/**
 * 상단 썸네일 타이틀을 교체
 */
function changeTopThumbnail(targetThumb) {
    if (DOM.thumbThumbs) {
        DOM.thumbThumbs.forEach(t => t.classList.remove('active'));
        if(targetThumb) targetThumb.classList.add('active');
    }
    
    const thumbUrl = targetThumb.getAttribute('data-thumb');
    const imgEl = document.getElementById('top-thumbnail-img');
    if (imgEl) {
        if (thumbUrl === 'none') {
            imgEl.style.display = 'none';
            imgEl.src = '';
        } else {
            imgEl.src = thumbUrl;
            imgEl.style.display = 'block';
        }
    }
    
    if(typeof updateTopPrizeSummary === 'function') updateTopPrizeSummary();
}

/**
 * 보드 뒷배경(커버) 이미지를 교체
 */
function changeBoardCover(targetThumb) {
    if (DOM.coverThumbs) {
        DOM.coverThumbs.forEach(t => t.classList.remove('active'));
        if(targetThumb) targetThumb.classList.add('active');
    }
    
    const coverUrl = targetThumb.getAttribute('data-cover');
    if (DOM.contentWrapper) {
        if (coverUrl === 'none') {
            DOM.contentWrapper.style.backgroundImage = 'none';
        } else {
            DOM.contentWrapper.style.backgroundImage = `url('${coverUrl}')`;
        }
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

    let totalPrizeCount = 0;
    const parsedPrizes = [];
    remainingPrizes = {};
    let hasError = false;

    // 1. 일반 (랜덤배치) 탭 데이터 읽기
    const normalRows = document.querySelectorAll('#prize-list-container .prize-row');
    normalRows.forEach(row => {
        const nameInput = row.querySelector('.prize-name').value.trim();
        const countInput = parseInt(row.querySelector('.prize-count').value, 10);

        if (nameInput && !isNaN(countInput) && countInput > 0) {
            totalPrizeCount += countInput;
            parsedPrizes.push({ name: nameInput, count: countInput, fixedCells: [] });
            remainingPrizes[nameInput] = (remainingPrizes[nameInput] || 0) + countInput;
        }
    });

    // 2. 고정칸 탭 데이터 읽기
    const fixedRows = document.querySelectorAll('#fixed-prize-list-container .fixed-row');
    fixedRows.forEach(row => {
        const nameInput = row.querySelector('.prize-name').value.trim();
        const fixedStr = row.querySelector('.prize-fixed-input').value.trim();

        if (nameInput && fixedStr) {
            const fixedArr = fixedStr.split(',').map(s => parseInt(s.trim(), 10))
                               .filter(n => !isNaN(n) && n >= 1 && n <= totalBoardSize);
            
            if (fixedArr.length > 0) {
                totalPrizeCount += fixedArr.length;
                parsedPrizes.push({ name: nameInput, count: fixedArr.length, fixedCells: fixedArr });
                remainingPrizes[nameInput] = (remainingPrizes[nameInput] || 0) + fixedArr.length;
            } else {
                alert(`[${nameInput}] 지정칸 조건이 유효하지 않습니다.`);
                hasError = true;
            }
        }
    });

    if (hasError) return;

    if (totalPrizeCount > totalBoardSize) {
        alert(`입력하신 상품의 총합(${totalPrizeCount}개)이 선택하신 보드 크기(${totalBoardSize}칸)를 초과했습니다!\n수량을 줄이거나 보드 크기를 키워주세요.`);
        return; 
    }

    currentTilesData = new Array(totalBoardSize).fill(null);
    let randomPrizesPool = [];
    let usedCells = new Set();
    
    // 1. 지정칸 상품 먼저 배치
    parsedPrizes.forEach(prize => {
        let placedFixedCount = 0;
        prize.fixedCells.forEach(cellNum => {
            const index = cellNum - 1;
            if (!usedCells.has(index)) {
                currentTilesData[index] = { type: 'prize', name: prize.name };
                usedCells.add(index);
                placedFixedCount++;
            } else {
                alert(`지정칸 [${cellNum}번]이 중복 지정되었습니다.`);
                hasError = true;
            }
        });
        
        // 2. 남은 수량은 랜덤 풀에 추가
        const remainingToPlace = prize.count - placedFixedCount;
        for (let i = 0; i < remainingToPlace; i++) {
            randomPrizesPool.push({ type: 'prize', name: prize.name });
        }
    });

    if (hasError) return;

    // 3. 꽝 갯수 계산하여 랜덤 풀에 추가
    const bustCount = totalBoardSize - totalPrizeCount;
    for (let i = 0; i < bustCount; i++) {
        randomPrizesPool.push({ type: 'bust', name: '꽝' });
    }

    // 4. 랜덤 풀 섞기
    shuffleArray(randomPrizesPool);

    // 5. 빈칸 찾아 랜덤 상품/꽝 순차적으로 넣기
    let poolIndex = 0;
    for (let i = 0; i < totalBoardSize; i++) {
        if (currentTilesData[i] === null) {
            currentTilesData[i] = randomPrizesPool[poolIndex++];
        }
    }

    renderBoard();
    updateTopPrizeSummary();

    isSettingComplete = true;
    
    // 새로 섞을 경우 뽑기 카운트 초기화
    drawCount = 0;

    DOM.board.classList.remove('shuffling');
    void DOM.board.offsetWidth; 
    DOM.board.classList.add('shuffling');

    if(window.updateObsUrl) window.updateObsUrl();
    
    // 초기화 시 싱크 데이터도 리셋
    broadcastBoardState();
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
    let maxW = 450;
    let fontSize = "2rem";
    
    if (totalBoardSize === 50) {
        columns = 10;
        maxW = 700;
        fontSize = "1.5rem";
    } else if (totalBoardSize === 100) {
        columns = 10;
        maxW = 600;
        fontSize = "1.1rem";
    }
    
    DOM.board.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    DOM.board.style.maxWidth = `${maxW}px`;
    DOM.board.style.fontSize = fontSize;
    
    if (DOM.contentWrapper) {
        DOM.contentWrapper.style.maxWidth = `${maxW}px`;
    }

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
                updateTopPrizeSummary();
            }
        }
        
        // 클릭 직후 현재 상태 전체를 로컬스토리지에 저장하여 다른 창과 동기화
        broadcastBoardState();
    };

    drawCount++;
    executeFlip();
}

/**
 * 전역 상태를 로컬 스토리지에 기록하여 다른 창에서 storage 이벤트 수신
 */
function broadcastBoardState() {
    const flippedIndices = [];
    document.querySelectorAll('.tile.flipped').forEach(t => {
        flippedIndices.push(parseInt(t.dataset.index, 10));
    });
    
    const payload = {
        ts: Date.now(),
        flipped: flippedIndices,
        remaining: remainingPrizes
    };
    
    // localStorage를 통해 이벤트 브로드캐스팅
    localStorage.setItem('boardSyncState', JSON.stringify(payload));
}

// --- [공통 화면 업데이트 함수] ---

function updateTopPrizeSummary() {
    const summaryContainer = document.getElementById('top-prize-summary');
    const imgEl = document.getElementById('top-thumbnail-img');
    if (!summaryContainer) return;

    if (!imgEl || imgEl.style.display === 'none') {
        summaryContainer.style.display = 'none';
        return;
    }
    
    summaryContainer.style.display = 'flex';
    summaryContainer.innerHTML = '';
    
    let count = 0;
    for (const [name, leftCount] of Object.entries(remainingPrizes)) {
        if (count >= 3) break;
        const span = document.createElement('span');
        span.innerText = `${name} ${leftCount}개`;
        summaryContainer.appendChild(span);
        count++;
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

window.updateObsUrl = function() {
    const selectedSizeRadio = document.querySelector('input[name="boardSize"]:checked');
    const size = parseInt(selectedSizeRadio.value, 10);
    const bgThumbnail = document.querySelector('.bg-thumb.active');
    const bg = bgThumbnail ? bgThumbnail.getAttribute('data-bg') : 'none';
    const bxThumbnail = document.querySelector('.box-thumb.active');
    const bx = bxThumbnail ? bxThumbnail.getAttribute('data-box') : 'none';
    const tnThumbnail = document.querySelector('.thumb-thumb.active');
    const tn = tnThumbnail ? tnThumbnail.getAttribute('data-thumb') : 'none';
    const cvThumbnail = document.querySelector('.cover-thumb.active');
    const cv = cvThumbnail ? cvThumbnail.getAttribute('data-cover') : 'none';
    
    const r = [];
    document.querySelectorAll('#prize-list-container .prize-row').forEach(row => {
        const n = row.querySelector('.prize-name').value.trim();
        const c = parseInt(row.querySelector('.prize-count').value, 10);
        if (n && !isNaN(c) && c > 0) r.push([n, c]);
    });
    
    const f = [];
    document.querySelectorAll('#fixed-prize-list-container .fixed-row').forEach(row => {
        const n = row.querySelector('.prize-name').value.trim();
        const str = row.querySelector('.prize-fixed-input').value.trim();
        if (n && str) f.push([n, str]);
    });
    
    const config = { s: size, bg: bg, bx: bx, tn: tn, cv: cv, r: r, f: f };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
    
    const baseUrl = window.location.href.split('?')[0]; 
    const newUrl = `${baseUrl}?obs=1&data=${b64}`;
    
    const input = document.getElementById('obs-url-input');
    if (input) input.value = newUrl;
};

window.copyObsUrl = function() {
    window.updateObsUrl();
    const urlInput = document.getElementById('obs-url-input');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(urlInput.value).then(() => {
            alert('OBS 송출용 주소가 복사되었습니다! 🎉\nOBS 브라우저 소스의 URL 항목에 붙여넣으세요.');
        }).catch(() => {
            urlInput.select();
            document.execCommand('copy');
            alert('주소가 복사되었습니다.\nOBS에 붙여넣기 하세요!');
        });
    } else {
        urlInput.select();
        document.execCommand('copy');
        alert('주소가 복사되었습니다.\nOBS에 붙여넣기 하세요!');
    }
};

window.toggleSettingsPanel = function() {
    const panel = document.getElementById('settings-panel');
    const btn = document.getElementById('btn-toggle-panel');
    if (panel.classList.contains('collapsed')) {
        panel.classList.remove('collapsed');
        btn.classList.remove('collapsed');
        btn.innerHTML = '◀';
    } else {
        panel.classList.add('collapsed');
        btn.classList.add('collapsed');
        btn.innerHTML = '▶';
    }
};

window.toggleGroup = function(headerEl) {
    const group = headerEl.parentElement;
    group.classList.toggle('collapsed');
    
    // 화살표 방향 회전은 CSS 클래스에서 정의된 transform을 따르며,
    // 원할 경우 innerHTML 텍스트를 변경할 수도 있습니다.
    const icon = headerEl.querySelector('.toggle-icon');
    if (group.classList.contains('collapsed')) {
        icon.innerHTML = '◀';
    } else {
        icon.innerHTML = '▼';
    }
};

window.loadFromUrl = function(dataStr) {
    try {
        const jsonStr = decodeURIComponent(escape(atob(dataStr)));
        const config = JSON.parse(jsonStr);
        
        const radio = document.querySelector(`input[name="boardSize"][value="${config.s}"]`);
        if (radio) radio.checked = true;
        
        const bgThumb = document.querySelector(`.bg-thumb[data-bg="${config.bg}"]`);
        if (bgThumb) {
            changeBackground(bgThumb);
        }
        
        const bxThumb = document.querySelector(`.box-thumb[data-box="${config.bx}"]`);
        if (bxThumb) {
            changeBoxImage(bxThumb);
        }
        
        const tnThumb = document.querySelector(`.thumb-thumb[data-thumb="${config.tn || 'none'}"]`);
        if (tnThumb) {
            changeTopThumbnail(tnThumb);
        }

        const cvThumb = document.querySelector(`.cover-thumb[data-cover="${config.cv || 'none'}"]`);
        if (cvThumb) {
            changeBoardCover(cvThumb);
        }
        
        const pCont = document.getElementById('prize-list-container');
        pCont.innerHTML = '';
        if (config.r.length === 0) {
            addPrizeRow(); 
        } else {
            config.r.forEach(item => {
                addPrizeRow();
                const rows = pCont.querySelectorAll('.prize-row');
                const lastRow = rows[rows.length - 1];
                lastRow.querySelector('.prize-name').value = item[0];
                lastRow.querySelector('.prize-count').value = item[1];
            });
        }
        
        const fCont = document.getElementById('fixed-prize-list-container');
        fCont.innerHTML = '';
        if (config.f.length === 0) {
            addFixedPrizeRow();
        } else {
            config.f.forEach(item => {
                addFixedPrizeRow();
                const rows = fCont.querySelectorAll('.fixed-row');
                const lastRow = rows[rows.length - 1];
                lastRow.querySelector('.prize-name').value = item[0];
                lastRow.querySelector('.prize-fixed-input').value = item[1];
            });
        }
    } catch(e) {
        console.error("URL 데이터 복구 실패", e);
    }
};

// --- [앱 초기화] ---
window.onload = () => {
    bindEvents();

    const urlParams = new URLSearchParams(window.location.search);
    const dataStr = urlParams.get('data');
    const isObs = urlParams.get('obs') === '1' || urlParams.get('obs') === 'true';

    if (dataStr) {
        window.loadFromUrl(dataStr);
    } else {
        const defaultBgThumb = document.querySelector('.bg-thumb[data-bg="img/bg_0000.webp"]');
        if (defaultBgThumb) {
            changeBackground(defaultBgThumb);
        }
        const defaultBxThumb = document.querySelector('.box-thumb[data-box="img/box_0002.png"]');
        if (defaultBxThumb) {
            changeBoxImage(defaultBxThumb);
        }
        const defaultTnThumb = document.querySelector('.thumb-thumb[data-thumb="img/thubnail_00.webp"]');
        if (defaultTnThumb) {
            changeTopThumbnail(defaultTnThumb);
        }
        const defaultCvThumb = document.querySelector('.cover-thumb[data-cover="img/bg_cover_00.webp"]');
        if (defaultCvThumb) {
            changeBoardCover(defaultCvThumb);
        }
    }

    if (isObs) {
        document.body.classList.add('obs-mode');
        toggleSettingsPanel(); 
        const bp = document.getElementById('broadcast-panel');
        if (bp) bp.style.paddingBottom = '0px'; 
        const ads = document.getElementById('adsense-container');
        if (ads) ads.style.display = 'none'; 
        
        if (dataStr) {
            setTimeout(() => { applySettings(); }, 100);
        }
    }
};
