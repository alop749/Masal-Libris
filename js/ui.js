export const ui = {
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showView(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
        });
        const target = document.getElementById(`${viewId}-view`);
        if (target) {
            target.style.display = 'block';
            target.classList.add('fade-in');
        }
        
        // Update sidebar active state
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.view === viewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    },

    renderBookCard(book, onClick) {
        const card = document.createElement('div');
        card.className = 'book-card fade-in';
        card.innerHTML = `
            <img src="${book.cover_url || 'https://via.placeholder.com/200x300?text=No+Cover'}" alt="${book.title}" class="book-cover">
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                <div class="book-author">${book.author}</div>
            </div>
        `;
        card.onclick = () => onClick(book);
        return card;
    },

    showSkeleton(containerId, count = 4) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'book-card skeleton';
            skeleton.style.height = '300px';
            container.appendChild(skeleton);
        }
    },

    hideModal() {
        document.getElementById('book-modal').style.display = 'none';
    },

    showModal() {
        document.getElementById('book-modal').style.display = 'flex';
    }
};
