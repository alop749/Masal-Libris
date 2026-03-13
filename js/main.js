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
        } else {
            btn.innerText = 'Iniciar Sesión';
            link.innerText = '¿No tienes cuenta? Regístrate';
            confirmContainer.style.display = 'none';
            document.getElementById('confirm-password').required = false;
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
        });
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
    document.getElementById('username-display').innerText = user.email.split('@')[0];
    
    ui.showView('dashboard');
    loadUserData();
}

function handleSignOut() {
    currentUser = null;
    document.getElementById('main-layout').style.display = 'none';
    document.getElementById('auth-view').style.display = 'block';
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
                    added_at: j.added_at
                };
            });
            renderJournal();
        }
        
        const { data: reviews, error: rError } = await supabase
            .from('reviews')
            .select('*, books(*)')
            .eq('user_id', currentUser.id);

        if (!rError) myReviews = reviews;
        
        renderReadingNow();
        renderFavorites();
        updateStats();
    } catch (e) {
        console.warn('Could not load data from Supabase. Make sure tables exist.', e);
    }
}

function renderReadingNow() {
    const container = document.getElementById('reading-now-container');
    if (!container) return;
    
    const activeBooks = myBooks.filter(b => b.status === 'reading');
    container.innerHTML = '';

    if (activeBooks.length === 0) {
        container.innerHTML = '<div class="empty-state">No tienes lecturas activas en este momento.</div>';
        return;
    }

    activeBooks.forEach(book => {
        const card = ui.renderBookCard(book, showJournalDetails);
        container.appendChild(card);
    });
}

function renderJournal() {
    const container = document.getElementById('journal-list');
    container.innerHTML = '';
    
    if (myBooks.length === 0) {
        container.innerHTML = '<div class="empty-state">Tu journal está vacío. ¡Empieza a buscar libros!</div>';
        return;
    }

    myBooks.forEach(book => {
        const card = ui.renderBookCard(book, showJournalDetails);
        container.appendChild(card);
    });
}

function renderFavorites() {
    const container = document.getElementById('favorites-list');
    if (!container) return;

    // Filter reviews that are marked as favorite and have book data
    const favoriteBooks = myReviews
        .filter(r => r.is_favorite && r.books)
        .map(r => ({
            ...r.books,
            is_favorite: true
        }));
    
    container.innerHTML = '';

    if (favoriteBooks.length === 0) {
        container.innerHTML = '<div class="empty-state">No tienes libros marcados como favoritos.</div>';
        return;
    }

    favoriteBooks.forEach(book => {
        const card = ui.renderBookCard(book, showJournalDetails);
        container.appendChild(card);
    });
}

function showJournalDetails(book) {
    ui.showModal();
    const modalBody = document.getElementById('modal-body');
    const userReview = myReviews.find(r => r.book_id === book.id) || { content: '', rating: 0 };

    modalBody.innerHTML = `
        <div style="flex: 1; min-width: 250px;">
            <img src="${book.cover_url || 'https://via.placeholder.com/250x375'}" style="width: 100%; border-radius: var(--radius-lg); box-shadow: var(--shadow);">
            <div style="margin-top: 1.5rem;">
                <label style="font-size:0.875rem; font-weight:600; color: var(--primary);">Estado de lectura</label>
                <select class="input-field" style="margin-top:0.5rem;" onchange="updateStatus('${book.id}', this.value)">
                    <option value="reading" ${book.status === 'reading' ? 'selected' : ''}>Leyendo</option>
                    <option value="finished" ${book.status === 'finished' ? 'selected' : ''}>Terminado</option>
                    <option value="want_to_read" ${book.status === 'want_to_read' ? 'selected' : ''}>Por leer</option>
                </select>
            </div>
        </div>
        <div style="flex: 2; min-width: 300px;">
            <h2 style="margin-top: 0; color: var(--primary);">${book.title}</h2>
            <p style="color: var(--secondary); font-weight: 500; margin-bottom: 1rem;">${book.author}</p>
            
            <div style="margin-bottom: 1.5rem; max-height: 150px; overflow-y: auto; padding-right: 10px;">
                <label style="font-size:0.75rem; font-weight:700; text-transform: uppercase; color: var(--gray-800); display: block; margin-bottom: 0.5rem;">Descripción</label>
                <p style="font-size: 0.875rem; color: var(--gray-900); line-height: 1.6;">${book.description || 'Sin descripción disponible.'}</p>
            </div>

            <div id="inline-review-container">
                <label style="font-size:0.875rem; font-weight:600; color: var(--primary);">Tu Reseña</label>
                <div id="review-text" contenteditable="true" class="input-field" style="min-height: 120px; margin-top: 0.5rem; background: var(--gray-50); cursor: text; line-height: 1.5;">
                    ${userReview.content || 'Escribe tus pensamientos sobre este libro...'}
                </div>
                <div style="margin-top: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <label style="font-size:0.875rem; font-weight:600;">Rating:</label>
                        <input type="number" id="review-rating" min="1" max="5" value="${userReview.rating}" class="input-field" style="width: 70px;">
                    </div>
                    <button id="save-review-btn" class="btn btn-primary" style="padding: 0.5rem 1.5rem;">Guardar Reseña</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('save-review-btn').onclick = () => saveReview(book.id);
}

async function saveReview(bookId) {
    const content = document.getElementById('review-text').innerText;
    const rating = parseInt(document.getElementById('review-rating').value);
    
    // Find metadata for safety
    const book = myBooks.find(b => b.id === bookId) || { id: bookId };

    ui.showToast('Guardando reseña...');
    
    try {
        await ensureBookExists(book);

        const { error } = await supabase
            .from('reviews')
            .upsert({ 
                book_id: bookId, 
                user_id: currentUser.id, 
                content, 
                rating,
                updated_at: new Date() 
            });

        if (error) throw error;
        
        ui.showToast('Reseña guardada!', 'success');
        loadUserData();
    } catch (e) {
        console.error('Save review error:', e);
        ui.showToast(e.message || 'Error al guardar reseña', 'error');
    }
}

async function updateStatus(bookId, status) {
    ui.showToast('Actualizando estado...');
    const { error } = await supabase
        .from('user_books')
        .update({ status })
        .match({ book_id: bookId, user_id: currentUser.id });
    
    if (error) {
        ui.showToast(error.message, 'error');
    } else {
        ui.showToast('Estado actualizado', 'success');
        // Reload all data to refresh Dashboard and Journal views
        await loadUserData();
    }
}

function updateStats() {
    document.getElementById('stat-total-books').innerText = stats.calculateTotalBooks(myBooks);
    document.getElementById('stat-avg-rating').innerText = stats.calculateAvgRating(myReviews);
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
            const card = ui.renderBookCard(book, showBookDetails);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Search failed:', error);
        ui.showToast('Error al buscar libros. Inténtalo de nuevo.', 'error');
        document.getElementById('search-results').innerHTML = '<div class="empty-state">Hubo un error en la búsqueda.</div>';
    }
}

async function showBookDetails(book) {
    ui.showModal();
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = '<div class="skeleton" style="width: 100%; height: 300px;"></div>';

    const details = await api.getBookDetails(book.id);
    
    modalBody.innerHTML = `
        <div style="flex: 1; min-width: 250px;">
            <img src="${book.cover_url || 'https://via.placeholder.com/250x375'}" style="width: 100%; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
        </div>
        <div style="flex: 2; min-width: 300px;">
            <h2 style="margin-top: 0;">${details.title}</h2>
            <p style="color: var(--secondary); font-weight: 600; margin-bottom: 0.5rem;">${book.author}</p>
            
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                <button class="lang-btn active" onclick="changeLang('${book.id}', 'es')">ES</button>
                <button class="lang-btn" onclick="changeLang('${book.id}', 'en')">EN</button>
                <button class="lang-btn" onclick="changeLang('${book.id}', 'it')">IT</button>
            </div>

            <div style="margin-bottom: 1.5rem;">
                ${details.subject.slice(0, 5).map(s => `<span class="badge" style="margin-right:0.5rem; margin-bottom:0.5rem; display:inline-block;">${s}</span>`).join('')}
            </div>
            <p id="modal-description" style="color: var(--gray-800); line-height: 1.6; margin-bottom: 2rem; max-height: 200px; overflow-y: auto;">${details.description}</p>
            
            <div style="display: flex; gap: 1rem;">
                <button id="add-to-journal-btn" class="btn btn-primary">Añadir al Journal</button>
                <button id="mark-fav" class="btn btn-ghost">♥ Favorito</button>
            </div>
        </div>
    `;

    document.getElementById('add-to-journal-btn').onclick = () => addToJournal(book);
    document.getElementById('mark-fav').onclick = () => toggleFavorite(book.id);
}

window.changeLang = async (bookId, lang) => {
    const descEl = document.getElementById('modal-description');
    
    // Open Library mostly has single-language descriptions. 
    // For real translation on the fly, we would need a Translation API.
    // I'll add a visual indicator and explanation.
    
    ui.showToast('Buscando versión en ' + lang.toUpperCase() + '...');
    
    descEl.style.opacity = '0.5';
    
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase() === lang);
    });

    // We try to fetch the details again. Open Library doesn't support 
    // langRestrict, so usually this will return the same main description.
    const details = await api.getBookDetails(bookId, lang);
    if (details) {
        descEl.innerText = details.description;
        if (lang !== 'en' && details.description.length < 50) {
            ui.showToast('Descripción no disponible en este idioma en Open Library.', 'info');
        }
    }
    descEl.style.opacity = '1';
};

async function ensureBookExists(book) {
    const { data: existingBook } = await supabase
        .from('books')
        .select('id')
        .eq('id', book.id)
        .maybeSingle();

    if (!existingBook) {
        const details = await api.getBookDetails(book.id);
        const { error: insertError } = await supabase.from('books').insert([{
            id: book.id,
            title: book.title || 'Título desconocido',
            author: book.author || 'Autor desconocido',
            cover_url: book.cover_url,
            description: details ? details.description : ''
        }]);
        if (insertError) throw insertError;
    }
}

async function toggleFavorite(bookId) {
    if (!currentUser) return ui.showToast('Debes iniciar sesión primero', 'error');
    
    // Find the book in current state to get its metadata if needed
    const book = myBooks.find(b => b.id === bookId) || 
                 { id: bookId, title: 'Libro' }; // Fallback

    ui.showToast('Actualizando favorito...');
    try {
        // Ensure book metadata exists before touching reviews
        await ensureBookExists(book);

        const { data, error: selectError } = await supabase
            .from('reviews')
            .select('is_favorite')
            .match({ book_id: bookId, user_id: currentUser.id })
            .maybeSingle();

        if (selectError) throw selectError;

        let isFav = data ? !data.is_favorite : true;

        const { error: upsertError } = await supabase.from('reviews').upsert({
            book_id: bookId,
            user_id: currentUser.id,
            is_favorite: isFav,
            updated_at: new Date()
        });

        if (upsertError) throw upsertError;

        ui.showToast(isFav ? 'Marcado como favorito ♥' : 'Quitado de favoritos', 'success');
        loadUserData();
    } catch (e) {
        console.error('Favorite error:', e);
        ui.showToast(e.message || 'Error al actualizar favorito', 'error');
    }
}

async function addToJournal(book) {
    if (!currentUser) return ui.showToast('Debes iniciar sesión primero', 'error');

    ui.showToast(`Añadiendo "${book.title}"...`);
    
    try {
        // 1. Ensure book exists in metadata table
        await ensureBookExists(book);

        // 2. Add to user_books
        const { error } = await supabase.from('user_books').insert([
            { 
                user_id: currentUser.id,
                book_id: book.id,
                status: 'want_to_read'
            }
        ]);
        
        if (error) {
            if (error.code === '23505') throw new Error('Ya tienes este libro en tu journal');
            throw error;
        }
        
        ui.showToast('¡Añadido con éxito!', 'success');
        loadUserData();
    } catch (error) {
        console.error('Add to journal error:', error);
        ui.showToast(error.message, 'error');
    }
}

init();
