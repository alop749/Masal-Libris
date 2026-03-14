export const api = {
    async translateToSpanish(text) {
        if (!text) return text;
        try {
            // Limits to prevent URL length issues
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text.substring(0, 1500))}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data && data[0]) {
                return data[0].map(item => item[0]).join('');
            }
        } catch (e) {
            console.error('Translation error:', e);
        }
        return text;
    },

    async searchBooks(query) {
        if (!query.trim()) return [];
        try {
            const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`);
            if (!response.ok) throw new Error('Error en la respuesta de Open Library');
            const data = await response.json();
            
            if (!data.docs || data.docs.length === 0) return [];

            return data.docs.map(book => ({
                id: book.key.replace('/works/', ''),
                title: book.title || 'Título desconocido',
                author: book.author_name ? book.author_name[0] : 'Autor desconocido',
                cover_url: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg?default=false` : null,
                published_date: book.first_publish_year || 'Desconocido',
                genres: book.subject ? book.subject.slice(0, 5) : [],
                source: 'openlibrary'
            }));
        } catch (error) {
            console.error('Error searching books with Open Library:', error);
            return [];
        }
    },

    async getBookDetails(workId, lang = 'es') {
        try {
            const response = await fetch(`https://openlibrary.org/works/${workId}.json`);
            if (!response.ok) throw new Error('Error al obtener detalles de Open Library');
            const data = await response.json();
            
            let description = 'Sin descripción disponible.';
            if (data.description) {
                if (typeof data.description === 'string') {
                    description = data.description;
                } else if (data.description.value) {
                    description = data.description.value;
                }
            }

            // Clean markdown-like tags
            description = description.replace(/\[.*?\]\(.*?\)/g, '');
            
            // Translate description automatically to Spanish
            description = await this.translateToSpanish(description);

            return {
                id: workId,
                title: data.title,
                description: description,
                cover_url: data.covers ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg?default=false` : null,
                subject: data.subjects ? data.subjects.slice(0, 10) : []
            };
        } catch (error) {
            console.error('Error fetching book details from Open Library:', error);
            return null;
        }
    }
};
