export const stats = {
    calculateTotalBooks(books) {
        return books.length;
    },

    calculateAvgRating(reviews) {
        if (reviews.length === 0) return 0;
        const sum = reviews.reduce((acc, rev) => acc + rev.rating, 0);
        return (sum / reviews.length).toFixed(1);
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
