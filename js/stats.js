export const stats = {
    calculateTotalBooks(books) {
        return books.filter(b => b.in_journal).length;
    },

    calculateAvgRating(reviews) {
        const rated = reviews.filter(r => r.rating && r.rating > 0);
        if (rated.length === 0) return 0;
        const sum = rated.reduce((acc, rev) => acc + rev.rating, 0);
        return (sum / rated.length).toFixed(1);
    },

    calculateTopGenres(books) {
        const counts = {};
        books.forEach(book => {
            if (book.genres) {
                book.genres.forEach(genre => {
                    counts[genre] = (counts[genre] || 0) + 1;
                });
            }
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    }
};
