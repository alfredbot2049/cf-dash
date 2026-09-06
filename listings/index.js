// C&F — the rental source registry.
//
// To add a source: write a file next to this one exporting
// { id, name, fetchListings } per _shape.js, then add one line here.
//
// Still to come. All three block plain HTTP from a server and need the
// Playwright route that mudah.js already uses for its detail pass:
//   PropertyGuru, iProperty, EdgeProp
module.exports = [
  require('./mudah'),
];
