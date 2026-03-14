import { auth } from './auth.js';
import { api } from './api.js';
import { ui } from './ui.js';
import { stats } from './stats.js';
import { supabase } from './supabase.js';

let currentUser = null;
let currentView = 'dashboard';
let myBooks = [];
let myReviews = [];

// Initialize
async function init() {
    setupEventListeners();

    // Check session
    const session = await auth.getSession();
    if (session) {
        handleSignIn(session.user);
    } else {
        ui.showView('auth');
        document.getElementById('auth-view').style.display = 'block';
    }

    auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            handleSignIn(session.user);
        } else if (event === 'SIGNED_OUT') {
            handleSignOut();
        }
    });
}

function setupEventListeners() {
    // Auth Form
    document.getElementById('auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const submitBtn = document.getElementById('auth-submit');
        const isSignUp = submitBtn.innerText === 'Regístrate';

        if (isSignUp && password !== confirmPassword) {
            ui.showToast('Las contraseñas no coinciden', 'error');
            return;
        }

        try {
            if (isSignUp) {
                const pwd = password;
                if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd) || !/[@$!%*?&]/.test(pwd)) {
                    ui.showToast('La contraseña no cumple con los requisitos mínimos', 'error');
                    return;
                }
                await auth.signUp(email, password);
                ui.showToast('¡Cuenta creada! Revisa tu email.');
            } else {
                await auth.signIn(email, password);
                ui.showToast('¡Bienvenido!');
            }
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    });

    document.getElementById('password')?.addEventListener('input', (e) => {
        const isSignUp = document.getElementById('auth-submit').innerText === 'Regístrate';
        if (!isSignUp) return;

        const pwd = e.target.value;
        document.getElementById('req-length').style.color = pwd.length >= 8 ? '#10b981' : '#ef4444';
        document.getElementById('req-upper').style.color = /[A-Z]/.test(pwd) ? '#10b981' : '#ef4444';
        document.getElementById('req-lower').style.color = /[a-z]/.test(pwd) ? '#10b981' : '#ef4444';
        document.getElementById('req-num').style.color = /[0-9]/.test(pwd) ? '#10b981' : '#ef4444';
        document.getElementById('req-special').style.color = /[@$!%*?&]/.test(pwd) ? '#10b981' : '#ef4444';
    });

    document.getElementById('toggle-auth').addEventListener('click', (e) => {
        e.preventDefault();
        const btn = document.getElementById('auth-submit');
        const link = document.getElementById('toggle-auth');
        const confirmContainer = document.getElementById('confirm-password-container');
        if (btn.innerText === 'Iniciar Sesión') {
            btn.innerText = 'Regístrate';
            link.innerText = '¿Ya tienes cuenta? Inicia Sesión';
            confirmContainer.style.display = 'block';
            document.getElementById('confirm-password').required = true;
            document.getElementById('password-requirements').style.display = 'block';
        } else {
            btn.innerText = 'Iniciar Sesión';
            link.innerText = '¿No tienes cuenta? Regístrate';
            confirmContainer.style.display = 'none';
            document.getElementById('confirm-password').required = false;
            document.getElementById('password-requirements').style.display = 'none';
        }
    });

    document.getElementById('toggle-password').addEventListener('click', () => {
        const passInput = document.getElementById('password');
        const confirmInput = document.getElementById('confirm-password');
        const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passInput.setAttribute('type', type);
        confirmInput.setAttribute('type', type);
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            ui.showView(view);
            if (view === 'search') document.getElementById('search-input').focus();
            if (view === 'config') document.getElementById('config-nickname').value = document.getElementById('username-display').innerText;

            // Close sidebar automatically on mobile when an item is clicked
            document.getElementById('sidebar')?.classList.remove('open');
        });
    });

    // Mobile Sidebar Toggle
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.add('open');
    });

    document.getElementById('close-sidebar-btn')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.remove('open');
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

    // Search
    document.getElementById('search-btn').addEventListener('click', performSearch);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Close Modal
    document.getElementById('close-modal').addEventListener('click', ui.hideModal);

    // Color Theme Picker
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            const theme = swatch.dataset.theme;
            applyTheme(theme);
            ui.showToast(`Tema ${theme} aplicado`);
        });
    });

    // Contact form
    document.getElementById('contact-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        ui.showToast('Enviando mensaje...');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const response = await fetch('https://formspree.io/f/xzdjvvln', {
                method: 'POST',
                body: new FormData(e.target),
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                ui.showToast('Mensaje enviado. Te contactaremos pronto.', 'success');
                e.target.reset();
            } else {
                ui.showToast('No se pudo enviar el mensaje', 'error');
            }
        } catch (error) {
            console.error(error);
            ui.showToast('No se pudo contactar al servidor', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    // Save Nickname
    document.getElementById('save-nickname-btn')?.addEventListener('click', async () => {
        const username = document.getElementById('config-nickname').value.trim();
        if (!username) return;
        ui.showToast('Actualizando perfil...');
        const { error } = await supabase.from('profiles').upsert({ id: currentUser.id, username, updated_at: new Date() });
        if (error) {
            ui.showToast(error.message, 'error');
        } else {
            ui.showToast('Perfil actualizado', 'success');
            document.getElementById('username-display').innerText = username;
            document.querySelectorAll('.username-greet').forEach(el => el.innerText = username);
        }
    });
}

function applyTheme(theme) {
    const themes = {
        default: { primary: '#540863', secondary: '#92487A', accent: '#E49BA6', light: '#FFD3D5' },
        ocean: { primary: '#084c61', secondary: '#177e89', accent: '#db3a34', light: '#e3f2fd' },
        forest: { primary: '#2d5a27', secondary: '#4a7c44', accent: '#8da290', light: '#f1f8e9' }
    };

    const colors = themes[theme] || themes.default;
    const root = document.documentElement;
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--secondary', colors.secondary);
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--light', colors.light);

    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    document.querySelector(`.color-swatch[data-theme="${theme}"]`).classList.add('active');
}

async function handleSignIn(user) {
    currentUser = user;
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('main-layout').style.display = 'flex';
    document.getElementById('user-email-display').innerText = user.email;

    // fetch Profile
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
    const nickname = profile && profile.username ? profile.username : user.email.split('@')[0];

    document.getElementById('username-display').innerText = nickname;
    document.querySelectorAll('.username-greet').forEach(el => el.innerText = nickname);

    ui.showView('dashboard');
    loadUserData();

    // Initialize or show Chatbase when user signs in
    if (!window.chatbaseScriptLoaded) {
        window.chatbaseScriptLoaded = true;
        (function () { if (!window.chatbase || window.chatbase("getState") !== "initialized") { window.chatbase = (...args) => { if (!window.chatbase.q) { window.chatbase.q = [] } window.chatbase.q.push(args) }; window.chatbase = new Proxy(window.chatbase, { get(target, prop) { if (prop === "q") { return target.q } return (...args) => target(prop, ...args) } }) } const onLoad = function () { const script = document.createElement("script"); script.src = "https://www.chatbase.co/embed.min.js"; script.id = "VQBKxfuz1yNmcHHHEjtuS"; script.domain = "www.chatbase.co"; document.body.appendChild(script) }; if (document.readyState === "complete") { onLoad() } else { window.addEventListener("load", onLoad) } })();
    } else {
        document.querySelectorAll('iframe[src*="chatbase.co"]').forEach(el => {
            if (el.parentElement) el.parentElement.style.display = 'block';
            el.style.display = 'block';
        });
    }
}

function handleSignOut() {
    currentUser = null;
    document.getElementById('main-layout').style.display = 'none';
    document.getElementById('auth-view').style.display = 'block';

    // Hide Chatbase widgets when user signs out
    document.querySelectorAll('iframe[src*="chatbase.co"]').forEach(el => {
        if (el.parentElement && el.parentElement.tagName === 'DIV') {
            el.parentElement.style.display = 'none';
        }
        el.style.display = 'none';
    });

    ui.showToast('Sesión cerrada');
}

async function loadUserData() {
    try {
        const { data: journal, error: jError } = await supabase
            .from('user_books')
            .select('*, books(*)');

        if (!jError) {
            // Map data so the book's string ID (OLID) is easily accessible as 'id'
            myBooks = journal.map(j => {
                const bookData = j.books || {};
                return {
                    ...bookData,
                    journal_id: j.id, // Save the journal entry UUID separately
                    id: j.book_id,    // Ensure ID is the book's string ID for FK consistency
                    status: j.status,
                    in_journal: j.in_journal,
                    in_wishlist: j.in_wishlist,
                    added_at: j.added_at
                };
            });
        }

        const { data: reviews, error: rError } = await supabase
            .from('reviews')
            .select('*, books(*)')
            .eq('user_id', currentUser.id);

        if (!rError) myReviews = reviews;

        renderReadingNow();
        renderJournal();
        renderFavorites();
        renderWishlist();
        updateStats();
    } catch (e) {
        console.warn('Could not load data from Supabase. Make sure tables exist.', e);
    }
}

function renderReadingNow() {
    const container = document.getElementById('reading-now-container');
    if (!container) return;

    // Only books that are in journal and being read
    const activeBooks = myBooks.filter(b => b.in_journal && b.status === 'reading');
    container.innerHTML = '';

    if (activeBooks.length === 0) {
        container.innerHTML = '<div class="empty-state">No tienes lecturas activas en este momento.</div>';
        return;
    }

    activeBooks.forEach(book => {
        const card = ui.renderBookCard(book, showBookModal);
        container.appendChild(card);
    });
}

function renderJournal() {
    const container = document.getElementById('journal-list');
    if (!container) return;
    container.innerHTML = '';

    const journalBooks = myBooks.filter(b => b.in_journal);

    if (journalBooks.length === 0) {
        container.innerHTML = '<div class="empty-state">Tu journal está vacío. ¡Empieza a buscar libros!</div>';
        return;
    }

    journalBooks.forEach(book => {
        const card = ui.renderBookCard(book, showBookModal);
        container.appendChild(card);
    });
}

function renderWishlist() {
    const container = document.getElementById('wishlist-list');
    if (!container) return;
    container.innerHTML = '';

    const wishlistBooks = myBooks.filter(b => b.in_wishlist);

    if (wishlistBooks.length === 0) {
        container.innerHTML = '<div class="empty-state">Tu lista de deseos está vacía.</div>';
        return;
    }

    wishlistBooks.forEach(book => {
        const card = ui.renderBookCard(book, showBookModal);
        container.appendChild(card);
    });
}

function renderFavorites() {
    const container = document.getElementById('favorites-list');
    if (!container) return;

    // Filter reviews that are marked as favorite and have book data
    const favoriteBooks = myReviews
        .filter(r => r.is_favorite && r.books)
        .map(r => {
            // Merge with myBooks so it retains in_wishlist, in_journal state dynamically edited
            const baseBook = myBooks.find(b => b.id === r.book_id) || r.books;
            return {
                ...baseBook,
                is_favorite: true
            };
        });

    container.innerHTML = '';

    if (favoriteBooks.length === 0) {
        container.innerHTML = '<div class="empty-state">No tienes libros marcados como favoritos.</div>';
        return;
    }

    favoriteBooks.forEach(book => {
        const card = ui.renderBookCard(book, showBookModal);
        container.appendChild(card);
    });
}

async function showBookModal(initialBook) {
    ui.showModal();
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = '<div class="skeleton" style="width: 100%; height: 300px;"></div>';

    // Fallback if it has been deleted or network fails
    let details = { description: 'Sin descripción disponible.' };
    try {
        const res = await api.getBookDetails(initialBook.id);
        if (res) details = res;
    } catch (e) { }

    // Check if user has this book saved
    const book = myBooks.find(b => b.id === initialBook.id) ||
        { ...initialBook, in_journal: false, in_wishlist: false, status: 'want_to_read' };

    book.title = details.title || book.title || initialBook.title;
    book.author = book.author || initialBook.author; // FIX AUTHOR
    book.cover_url = book.cover_url || initialBook.cover_url || details.cover_url;
    book.description = details.description || book.description || 'Sin descripción disponible.';

    const userReview = myReviews.find(r => r.book_id === book.id) || { content: '', rating: 0, is_favorite: false };

    const modalCoverUrl = book.cover_url && book.cover_url !== 'null' ? book.cover_url : 'https://placehold.co/250x375?text=Sin+Portada';

    modalBody.innerHTML = `
        <div style="flex: 1; min-width: 250px;">
            <img src="${modalCoverUrl}" onerror="this.onerror=null;this.src='https://placehold.co/250x375?text=Sin+Portada';" style="width: 100%; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
            
            <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                <button id="modal-journal-btn" class="btn ${book.in_journal ? 'btn-ghost active' : 'btn-primary'}" style="width:100%;">
                    ${book.in_journal ? '✓ En Journal' : '+ Añadir al Journal'}
                </button>
                <button id="modal-wishlist-btn" class="btn ${book.in_wishlist ? 'btn-ghost active' : 'btn-secondary'}" style="width:100%; background: var(--light); color: var(--primary);">
                    ${book.in_wishlist ? '✓ En Wishlist' : '+ Añadir a Wishlist'}
                </button>
                <button id="modal-fav-btn" class="btn ${userReview.is_favorite ? 'btn-ghost active' : 'btn-ghost'}" style="width:100%; border: 1px solid var(--primary);">
                    ${userReview.is_favorite ? '♥ Favorito' : '♡ Marcar Favorito'}
                </button>

                ${(book.journal_id || book.in_journal || book.in_wishlist || userReview.id || userReview.is_favorite || userReview.content || userReview.rating > 0) ? `
                <button id="modal-delete-btn" class="btn" style="width:100%; margin-top: 1.5rem; background: #fee2e2; color: #ef4444; border: 1px solid #f87171;">
                    🗑️ Eliminar de la biblioteca
                </button>
                ` : ''}

                ${(book.in_journal || book.in_wishlist) ? `
                <div style="margin-top: 1rem;">
                    <label style="font-size:0.875rem; font-weight:600; color: var(--primary);">Estado de lectura</label>
                    <select class="input-field" style="margin-top:0.5rem;" onchange="updateStatus('${book.id}', this.value)">
                        <option value="reading" ${book.status === 'reading' ? 'selected' : ''}>Leyendo</option>
                        <option value="finished" ${book.status === 'finished' ? 'selected' : ''}>Terminado</option>
                        <option value="want_to_read" ${book.status === 'want_to_read' ? 'selected' : ''}>Pendiente / Por leer</option>
                    </select>
                </div>
                ` : ''}
            </div>
        </div>
        <div style="flex: 2; min-width: 300px;">
            <h2 style="margin-top: 0;">${book.title}</h2>
            <p style="color: var(--secondary); font-weight: 600; margin-bottom: 0.5rem;">${book.author}</p>
            
            <div style="margin-bottom: 1.5rem; max-height: 150px; overflow-y: auto; padding-right: 10px;">
                <p id="modal-description" style="color: var(--gray-800); line-height: 1.6;">${book.description}</p>
            </div>
            
            ${(book.in_journal || book.in_wishlist || userReview.is_favorite) ? `
            <div id="inline-review-container">
                <label style="font-size:0.875rem; font-weight:600; color: var(--primary);">Tu Reseña</label>
                <div id="review-text" contenteditable="true" class="input-field" style="min-height: 80px; margin-top: 0.5rem; background: var(--gray-50); cursor: text; line-height: 1.5;">${userReview.content || ''}</div>
                <div style="margin-top: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <label style="font-size:0.875rem; font-weight:600;">Rating:</label>
                        <input type="number" step="0.1" id="review-rating" min="0" max="5" value="${userReview.rating || 0}" class="input-field" style="width: 70px;">
                    </div>
                    <button id="save-review-btn" class="btn btn-primary" style="padding: 0.5rem 1.5rem;">Guardar Reseña</button>
                </div>
            </div>` : ''}
        </div>
    `;

    document.getElementById('modal-journal-btn').onclick = () => toggleJournal(book);
    document.getElementById('modal-wishlist-btn').onclick = () => toggleWishlist(book);
    document.getElementById('modal-fav-btn').onclick = () => toggleFavorite(book);

    if (document.getElementById('modal-delete-btn')) {
        document.getElementById('modal-delete-btn').onclick = () => deleteBookFromLibrary(book.id);
    }

    if (document.getElementById('save-review-btn')) {
        document.getElementById('save-review-btn').onclick = () => saveReview(book);
    }
    if (document.getElementById('review-text')) {
        document.getElementById('review-text').onblur = () => saveReview(book);
        document.getElementById('review-rating').onblur = () => saveReview(book);
    }
}

window.deleteBookFromLibrary = async function (bookId) {
    if (!confirm('¿Seguro que deseas eliminar este libro completamente de tu biblioteca y todo su registro?')) return;
    ui.showToast('Eliminando libro...');
    try {
        await supabase.from('user_books').delete().match({ book_id: bookId, user_id: currentUser.id });
        await supabase.from('reviews').delete().match({ book_id: bookId, user_id: currentUser.id });
        ui.showToast('Libro eliminado', 'success');
        ui.hideModal();
        await loadUserData();
    } catch (e) {
        console.error(e);
        ui.showToast('Error al eliminar: ' + e.message, 'error');
    }
};

async function saveReview(book) {
    const elText = document.getElementById('review-text');
    const elRating = document.getElementById('review-rating');
    if (!elText || !elRating) return;

    const content = elText.innerText;
    const rating = parseFloat(elRating.value) || 0;

    ui.showToast('Guardando reseña...');

    try {
        await ensureBookExists(book);

        const { data: existingReview } = await supabase
            .from('reviews')
            .select('id, is_favorite')
            .match({ book_id: book.id, user_id: currentUser.id })
            .maybeSingle();

        if (existingReview) {
            const { error: updateError } = await supabase
                .from('reviews')
                .update({ content, rating, updated_at: new Date() })
                .eq('id', existingReview.id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabase
                .from('reviews')
                .insert([{
                    book_id: book.id,
                    user_id: currentUser.id,
                    content,
                    rating,
                    is_favorite: false
                }]);
            if (insertError) throw insertError;
        }

        ui.showToast('Reseña guardada!', 'success');
        await loadUserData();
    } catch (e) {
        console.error('Save review error:', e);
        ui.showToast(e.message || 'Error al guardar reseña', 'error');
    }
}

async function ensureBookExists(book) {
    const { data: existingBook } = await supabase
        .from('books')
        .select('*')
        .eq('id', book.id)
        .maybeSingle();

    let details = null;
    try {
        details = await api.getBookDetails(book.id);
    } catch (e) { }

    const finalTitle = book.title || (details && details.title) || 'Título desconocido';
    const finalAuthor = book.author || 'Autor desconocido';
    const finalCover = book.cover_url || (details && details.cover_url) || null;
    const finalDesc = (details && details.description) ? details.description : '';

    if (!existingBook) {
        const { error: insertError } = await supabase.from('books').insert([{
            id: book.id,
            title: finalTitle,
            author: finalAuthor,
            cover_url: finalCover,
            description: finalDesc
        }]);
        if (insertError) throw insertError;
    } else {
        const updates = {};
        if (!existingBook.cover_url && finalCover && finalCover !== 'null') updates.cover_url = finalCover;
        if ((!existingBook.description || existingBook.description === 'Sin descripción disponible.') && finalDesc && finalDesc !== 'Sin descripción disponible.') updates.description = finalDesc;
        if (existingBook.title === 'Libro' || existingBook.title === 'Título desconocido') updates.title = finalTitle;
        if (existingBook.author === 'Autor desconocido' && finalAuthor !== 'Autor desconocido') updates.author = finalAuthor;

        if (Object.keys(updates).length > 0) {
            await supabase.from('books').update(updates).eq('id', book.id);
        }
    }
}

window.updateStatus = async function (bookId, status) {
    ui.showToast('Actualizando estado...');
    const { error } = await supabase
        .from('user_books')
        .update({ status })
        .match({ book_id: bookId, user_id: currentUser.id });

    if (error) {
        ui.showToast(error.message, 'error');
    } else {
        ui.showToast('Estado actualizado', 'success');
        await loadUserData();
    }
};

function updateStats() {
    document.getElementById('stat-total-books').innerText = stats.calculateTotalBooks(myBooks);
    document.getElementById('stat-avg-rating').innerText = stats.calculateAvgRating(myReviews);

    const favoritesCount = myReviews.filter(r => r.is_favorite).length;
    const favElem = document.getElementById('stat-favs');
    if (favElem) favElem.innerText = favoritesCount;
}

async function performSearch() {
    const searchInput = document.getElementById('search-input');
    const query = searchInput.value;

    if (!query || !query.trim()) {
        ui.showToast('Por favor, ingresa un término de búsqueda', 'error');
        return;
    }

    ui.showSkeleton('search-results');

    try {
        const results = await api.searchBooks(query);
        const container = document.getElementById('search-results');
        container.innerHTML = '';

        if (results.length === 0) {
            container.innerHTML = '<div class="empty-state">No se encontraron libros para tu búsqueda.</div>';
            return;
        }

        results.forEach(book => {
            const card = ui.renderBookCard(book, showBookModal);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Search failed:', error);
        ui.showToast('Error al buscar libros. Inténtalo de nuevo.', 'error');
        document.getElementById('search-results').innerHTML = '<div class="empty-state">Hubo un error en la búsqueda.</div>';
    }
}

async function toggleFavorite(book) {
    if (!currentUser) return ui.showToast('Debes iniciar sesión primero', 'error');

    ui.showToast('Actualizando favorito...');
    try {
        await ensureBookExists(book);

        const { data, error: selectError } = await supabase
            .from('reviews')
            .select('is_favorite')
            .match({ book_id: book.id, user_id: currentUser.id })
            .maybeSingle();

        if (selectError) throw selectError;

        let isFav = data ? !data.is_favorite : true;

        const { error: upsertError } = await supabase.from('reviews').upsert({
            book_id: book.id,
            user_id: currentUser.id,
            is_favorite: isFav,
            updated_at: new Date()
        }, { onConflict: 'user_id,book_id' });

        if (upsertError) throw upsertError;

        ui.showToast(isFav ? 'Marcado como favorito ♥' : 'Quitado de favoritos', 'success');
        await loadUserData();

        // Re-open modal with updated state
        const updatedBook = myBooks.find(b => b.id === book.id) || book;
        showBookModal(updatedBook);
    } catch (e) {
        console.error('Favorite error:', e);
        ui.showToast(e.message || 'Error al actualizar favorito', 'error');
    }
}

async function toggleJournal(book) {
    if (!currentUser) return ui.showToast('Debes iniciar sesión primero', 'error');

    try {
        await ensureBookExists(book);
        const existing = myBooks.find(b => b.id === book.id);
        const isCurrentlyInJournal = existing ? existing.in_journal : false;

        ui.showToast(isCurrentlyInJournal ? 'Quitando del Journal...' : 'Añadiendo al Journal...');

        if (existing) {
            const { error } = await supabase.from('user_books').update({
                in_journal: !isCurrentlyInJournal,
                status: isCurrentlyInJournal ? existing.status : 'reading' // Keep status if removing, set reading if adding
            }).eq('id', existing.journal_id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('user_books').insert([{
                user_id: currentUser.id,
                book_id: book.id,
                status: 'reading',
                in_journal: true,
                in_wishlist: false
            }]);
            if (error) throw error;
        }

        ui.showToast(isCurrentlyInJournal ? 'Quitado del Journal' : 'Añadido al Journal', 'success');
        await loadUserData();

        const updatedBook = myBooks.find(b => b.id === book.id) || { ...book, in_journal: !isCurrentlyInJournal };
        showBookModal(updatedBook);

    } catch (error) {
        console.error('Journal toggle error:', error);
        ui.showToast(error.message, 'error');
    }
}

async function toggleWishlist(book) {
    if (!currentUser) return ui.showToast('Debes iniciar sesión primero', 'error');

    try {
        await ensureBookExists(book);
        const existing = myBooks.find(b => b.id === book.id);
        const isCurrentlyInWishlist = existing ? existing.in_wishlist : false;

        ui.showToast(isCurrentlyInWishlist ? 'Quitando de Wishlist...' : 'Añadiendo a Wishlist...');

        if (existing) {
            const { error } = await supabase.from('user_books').update({
                in_wishlist: !isCurrentlyInWishlist,
                status: isCurrentlyInWishlist ? existing.status : 'want_to_read'
            }).eq('id', existing.journal_id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('user_books').insert([{
                user_id: currentUser.id,
                book_id: book.id,
                status: 'want_to_read',
                in_journal: false,
                in_wishlist: true
            }]);
            if (error) throw error;
        }

        ui.showToast(isCurrentlyInWishlist ? 'Quitado de Wishlist' : 'Añadido a Wishlist', 'success');
        await loadUserData();

        const updatedBook = myBooks.find(b => b.id === book.id) || { ...book, in_wishlist: !isCurrentlyInWishlist };
        showBookModal(updatedBook);

    } catch (error) {
        console.error('Wishlist toggle error:', error);
        ui.showToast(error.message, 'error');
    }
}

init();
