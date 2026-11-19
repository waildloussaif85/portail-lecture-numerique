let INSTITUTION_TITLE = localStorage.getItem('lib_inst_name') || 'اسم المكتبة أو المؤسسة';
let LIBRARY_PHONE = localStorage.getItem('lib_inst_phone') || '21600000000';
let SHEET_ID = localStorage.getItem('lib_sheet_id') || '';

const instEl = document.getElementById('institutionName');
if (instEl) instEl.textContent = INSTITUTION_TITLE;

let books = [];
let favorites = JSON.parse(localStorage.getItem('lib_favs') || '[]');
let borrowedHistory = JSON.parse(localStorage.getItem('lib_borrowed_titles') || '[]');
let currentFilter = 'all';
let currentBorrowBook = null;
let scanner = null;
let pdfDoc = null, currentPage = 1, totalPages = 1, isDemoBook = false, demoPages = [];

function onClick(id, fn) {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function openSettings() {
    document.getElementById('setInstName').value = INSTITUTION_TITLE === 'اسم المكتبة أو المؤسسة' ? '' : INSTITUTION_TITLE;
    document.getElementById('setPhone').value = LIBRARY_PHONE === '21600000000' ? '' : LIBRARY_PHONE;
    document.getElementById('setSheetId').value = SHEET_ID;
    document.getElementById('settingsModal').classList.remove('hidden');
}

onClick('editInstBtn', openSettings);
onClick('settingsBtn', openSettings);

const settingsForm = document.getElementById('settingsForm');
if (settingsForm) {
    settingsForm.onsubmit = (e) => {
        e.preventDefault();
        const n = document.getElementById('setInstName').value.trim();
        const p = document.getElementById('setPhone').value.trim();
        const s = document.getElementById('setSheetId').value.trim();
        if (n) { INSTITUTION_TITLE = n; localStorage.setItem('lib_inst_name', n); if (instEl) instEl.textContent = n; }
        if (p) { LIBRARY_PHONE = p; localStorage.setItem('lib_inst_phone', p); }
        SHEET_ID = s; localStorage.setItem('lib_sheet_id', s);
        closeModal('settingsModal');
        loadBooks();
    };
}

async function loadBooks() {
    const container = document.getElementById('booksContainer');
    if (!SHEET_ID) {
        books = [
            { id: '101', title: 'مقدمة ابن خلدون', author: 'عبد الرحمن ابن خلدون', lang: 'ar', status: 'موجود', category: 'تاريخ', shelf: 'رف A1', barcode: '123456', pdfUrl: 'DEMO', pages: ['<h3>الفصل الأول</h3><p>اعلم أن فن التاريخ فن عزيز المذهب جم الفوائد شريف الغاية...</p>', '<h3>تابع الفصل الأول</h3><p>فإن الاجتماع الإنساني ضروري، ويعبر الحكماء عن هذا بقولهم: الإنسان مدني بالطبع...</p>'] },
            { id: '102', title: 'Le Petit Prince', author: 'Antoine de Saint-Exupéry', lang: 'fr', status: 'موجود', category: 'روايات', shelf: 'رف B2', barcode: '789012', pdfUrl: 'DEMO', pages: ['<h3>Chapitre I</h3><p>Lorsque j’avais six ans j’ai vu, une fois, une magnifique image...</p>', '<h3>Chapitre II</h3><p>J’ai ainsi vécu seul, sans personne avec qui parler véritablement...</p>'] },
            { id: '103', title: 'طوق الحمامة', author: 'ابن حزم الأندلسي', lang: 'ar', status: 'موجود', category: 'أدب', shelf: 'رف A4', barcode: '456789', pdfUrl: '' }
        ];
        updateCounters();
        renderBooks();
        return;
    }

    container.innerHTML = '<div class="status-msg">جاري تحميل الكتب...</div>';
    try {
        const res = await fetch('https://google.com' + SHEET_ID + '/gviz/tq?tqx=out:json');
        const txt = await res.text();
        const json = JSON.parse(txt.substring(47).slice(0, -2));
        books = json.table.rows.map(r => {
            const c = r.c || [];
            return {
                id: c[0] && c[0].v != null ? String(c[0].v).trim() : '',
                title: c[1] && c[1].v != null ? String(c[1].v).trim() : '',
                author: c[2] && c[2].v != null ? String(c[2].v).trim() : '',
                lang: c[3] && c[3].v != null ? String(c[3].v).toLowerCase().trim() : 'ar',
                status: c[4] && c[4].v != null ? String(c[4].v).trim() : 'موجود',
                category: c[5] && c[5].v != null ? String(c[5].v).trim() : '',
                shelf: c[6] && c[6].v != null ? String(c[6].v).trim() : '',
                barcode: c[7] && c[7].v != null ? String(c[7].v).trim() : '',
                pdfUrl: c[8] && c[8].v != null ? String(c[8].v).trim() : ''
            };
        }).filter(b => b.title && b.title !== 'العنوان' && b.title !== 'title');
        updateCounters();
        renderBooks();
    } catch (e) {
        container.innerHTML = '<div class="status-msg" style="color:red;">⚠️ تعذر تحميل الكتب. تأكد من معرّف الجدول.</div>';
    }
}

async function fetchCover(title, imgEl) {
    try {
        const res = await fetch('https://googleapis.com' + encodeURIComponent(title) + '&maxResults=1');
        const data = await res.json();
        if (data.items && data.items[0] && data.items[0].volumeInfo && data.items[0].volumeInfo.imageLinks) {
            imgEl.src = data.items[0].volumeInfo.imageLinks.thumbnail.replace('http:', 'https:');
        }
    } catch (_) {}
}
function updateCounters() {
    document.getElementById('statTotal').textContent = books.length;
    document.getElementById('statAvail').textContent = books.filter(b => b.status === 'موجود').length;
    document.getElementById('statDigital').textContent = books.filter(b => b.pdfUrl !== '').length;
    document.getElementById('statFav').textContent = favorites.length;
}

function renderBooks() {
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    const container = document.getElementById('booksContainer');
    container.innerHTML = '';

    const list = books.filter(b => {
        const match = [b.title, b.author, b.id, b.shelf, b.category, b.barcode].some(f => f.toLowerCase().includes(q));
        if (!match) return false;
        if (currentFilter === 'available') return b.status === 'موجود';
        if (currentFilter === 'digital') return b.pdfUrl !== '';
        if (currentFilter === 'ar') return b.lang === 'ar';
        if (currentFilter === 'fr') return b.lang === 'fr';
        if (currentFilter === 'fav') return favorites.includes(b.id || b.title);
        return true;
    });

    if (!list.length) {
        container.innerHTML = '<div class="status-msg">لا توجد كتب مطابقة للبحث.</div>';
        return;
    }

    list.forEach(book => {
        const isAvail = book.status === 'موجود';
        const key = book.id || book.title;
        const isFav = favorites.includes(key);

        const card = document.createElement('div');
        card.className = 'book-card';
        card.dir = 'auto';

        const img = document.createElement('img');
        img.className = 'book-cover';
        img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://w3.org" width="82" height="118"><rect width="82" height="118" fill="%230ea5e9"/><text x="41" y="65" font-size="30" text-anchor="middle" fill="white">📖</text></svg>';
        fetchCover(book.title, img);

        const body = document.createElement('div');
        body.className = 'book-body';

        const idTag = book.id ? '<span class="tag">#' + book.id + '</span> ' : '';
        const shelfTag = book.shelf ? '<span class="tag shelf-tag">📍 ' + book.shelf + '</span> ' : '';
        const catTag = book.category ? '<span class="tag">' + book.category + '</span>' : '';
        const statusClass = isAvail ? 'avail' : 'unavail';

        body.innerHTML =
            '<div>' +
                '<div class="meta-row"><div>' + idTag + shelfTag + catTag + '</div>' +
                '<span class="status-pill ' + statusClass + '">' + book.status + '</span></div>' +
                '<h3 class="book-title">' + book.title + '</h3>' +
                '<p class="book-author">✍️ ' + (book.author || 'غير محدد') + '</p>' +
            '</div>' +
            '<div class="actions-row"></div>';

        const actions = body.querySelector('.actions-row');

        const borrowBtn = document.createElement('button');
        borrowBtn.type = 'button';
        borrowBtn.className = isAvail ? 'btn-sm btn-borrow' : 'btn-sm btn-disabled';
        borrowBtn.textContent = isAvail ? '📦 إعارة' : 'معار حالياً';
        if (isAvail) borrowBtn.onclick = () => openBorrow(key); else borrowBtn.disabled = true;
        actions.appendChild(borrowBtn);

        if (book.pdfUrl) {
            const readBtn = document.createElement('button');
            readBtn.type = 'button';
            readBtn.className = 'btn-sm btn-read';
            readBtn.textContent = '📖 قراءة';
            readBtn.onclick = () => openPageReader(key);
            actions.appendChild(readBtn);
        }

        const favBtn = document.createElement('button');
        favBtn.type = 'button';
        favBtn.className = 'btn-sm btn-fav';
        favBtn.textContent = isFav ? '❤️' : '🤍';
        favBtn.onclick = () => toggleFav(key);
        actions.appendChild(favBtn);

        card.appendChild(img);
        card.appendChild(body);
        container.appendChild(card);
    });
}

async function openPageReader(key) {
    const book = books.find(b => (b.id || b.title) === key);
    if (!book) return;
    document.getElementById('readerTitle').textContent = '📖 ' + book.title;
    document.getElementById('readerModal').classList.remove('hidden');

    const canvas = document.getElementById('pdfCanvas');
    const demoBox = document.getElementById('demoPageContent');

    if (book.pdfUrl === 'DEMO') {
        isDemoBook = true;
        demoPages = book.pages || ['صفحة تجريبية'];
        currentPage = 1;
        totalPages = demoPages.length;
        canvas.classList.add('hidden');
        demoBox.classList.remove('hidden');
        renderCurrentPage();
    } else {
        isDemoBook = false;
        demoBox.classList.add('hidden');
        canvas.classList.remove('hidden');
        try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cloudflare.com';
            pdfDoc = await pdfjsLib.getDocument(book.pdfUrl).promise;
            totalPages = pdfDoc.numPages;
            currentPage = 1;
            renderCurrentPage();
        } catch (e) {
            demoBox.innerHTML = '<p style="text-align:center;">تعذر تحميل ملف PDF مباشرة.</p>';
            canvas.classList.add('hidden');
            demoBox.classList.remove('hidden');
        }
    }
}

async function renderCurrentPage() {
    document.getElementById('pageIndicator').textContent = 'صفحة ' + currentPage + ' من ' + totalPages;
    document.getElementById('prevPageBtn').disabled = currentPage <= 1;
    document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;

    if (isDemoBook) {
        const demoBox = document.getElementById('demoPageContent');
        demoBox.dir = 'auto';
        demoBox.innerHTML = demoPages[currentPage - 1];
    } else if (pdfDoc) {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.3 });
        const canvas = document.getElementById('pdfCanvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
}

onClick('prevPageBtn', () => { if (currentPage > 1) { currentPage--; renderCurrentPage(); } });
onClick('nextPageBtn', () => { if (currentPage < totalPages) { currentPage++; renderCurrentPage(); } });

function toggleFav(key) {
    favorites = favorites.includes(key) ? favorites.filter(k => k !== key) : [...favorites, key];
    localStorage.setItem('lib_favs', JSON.stringify(favorites));
    updateCounters();
    renderBooks();
}

onClick('darkModeBtn', () => document.body.classList.toggle('dark'));

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderBooks();
    };
});

const searchInput = document.getElementById('searchInput');
if (searchInput) searchInput.oninput = renderBooks;

function openBorrow(key) {
    currentBorrowBook = books.find(b => (b.id || b.title) === key);
    if (!currentBorrowBook) return;
    document.getElementById('borrowBookInfo').textContent = '📚 ' + currentBorrowBook.title + ' (الرقم: #' + currentBorrowBook.id + ')';
    document.getElementById('borrowModal').classList.remove('hidden');
}

const borrowForm = document.getElementById('borrowForm');
if (borrowForm) {
    borrowForm.onsubmit = (e) => {
        e.preventDefault();
        const bName = document.getElementById('bName').value.trim();
        const bAge = document.getElementById('bAge').value.trim();
        const bSub = document.getElementById('bCardId').value.trim();
        const bPhone = document.getElementById('bPhone').value.trim();
        const bDur = document.getElementById('bDuration').value;

        if (currentBorrowBook && !borrowedHistory.includes(currentBorrowBook.title)) {
            borrowedHistory.push(currentBorrowBook.title);
            localStorage.setItem('lib_borrowed_titles', JSON.stringify(borrowedHistory));
        }
        localStorage.setItem('member_saved_name', bName);
        localStorage.setItem('member_saved_sub', bSub);

        const msg = '🏛️ طلب إعارة من ' + INSTITUTION_TITLE + ':\n' +
            '📚 الكتاب: ' + currentBorrowBook.title + ' (#' + currentBorrowBook.id + ')\n' +
            '👤 الاسم واللقب: ' + bName + '\n' +
            '🎂 العمر: ' + bAge + ' سنة\n' +
            '🪪 رقم الاشتراك: ' + bSub + '\n' +
            '📞 الهاتف: ' + bPhone + '\n' +
            '⏳ المدة: ' + bDur;

        window.open('https://wa.me' + LIBRARY_PHONE + '?text=' + encodeURIComponent(msg), '_blank');
        closeModal('borrowModal');
    };
}

onClick('cardBtn', () => {
    document.getElementById('mName').value = localStorage.getItem('member_saved_name') || '';
    document.getElementById('mSubId').value = localStorage.getItem('member_saved_sub') || '';
    const favTitles = books.filter(b => favorites.includes(b.id || b.title)).map(b => b.title);
    const allSelectedTitles = [...new Set([...borrowedHistory, ...favTitles])];
    document.getElementById('mBooks').value = allSelectedTitles.join(' ، ');
    document.getElementById('memberModal').classList.remove('hidden');
});

const memberForm = document.getElementById('memberForm');
if (memberForm) {
    memberForm.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('mName').value.trim();
        const subId = document.getElementById('mSubId').value.trim();
        const bookTitles = document.getElementById('mBooks').value.trim();

        localStorage.setItem('member_saved_name', name);
        localStorage.setItem('member_saved_sub', subId);

           const qrData = 'المؤسسة: ' + INSTITUTION_TITLE + ' | المنخرط: ' + name + ' | رقم الاشتراك: ' + subId + ' | الكتب: ' + bookTitles;
        const preview = document.getElementById('digitalCardPreview');
        preview.innerHTML =
            '<h4 style="margin:0 0 8px;">🏛️ بطاقة معطيات المنخرط - ' + INSTITUTION_TITLE + '</h4>' +
            '<p style="margin:4px 0;font-size:15px;"><strong>👤 الاسم واللقب:</strong> ' + name + '</p>' +
            '<p style="margin:4px 0;font-size:14px;"><strong>🪪 رقم الاشتراك:</strong> ' + subId + '</p>' +
            '<div style="background:rgba(255,255,255,0.18);padding:8px;border-radius:10px;margin:8px 0;font-size:13px;">' +
                '<strong>📚 عناوين الكتب للإعارة:</strong><br>' + bookTitles +
            '</div>' +
            '<img src="https://qrserver.com' + encodeURIComponent(qrData) + '" style="background:white;padding:5px;border-radius:8px;margin-top:6px;">';
        preview.classList.remove('hidden');
    };
}

onClick('scanBtn', () => {
    document.getElementById('scannerModal').classList.remove('hidden');
    if (typeof Html5Qrcode !== 'undefined') {
        scanner = new Html5Qrcode("qrReader");
        scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 220 }, (code) => {
            document.getElementById('searchInput').value = code;
            stopScan();
            renderBooks();
        }).catch(() => alert("الكاميرا تعمل بعد رفع الموقع على رابط HTTPS."));
    }
});

function stopScan() { if (scanner) scanner.stop().catch(() => {}); closeModal('scannerModal'); }
onClick('closeScanBtn', stopScan);

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('copy', e => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        alert('النسخ غير مسموح.');
    }
});

loadBooks();
 
