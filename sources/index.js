// C&F — the source registry.
//
// To add a new event source: write a file next to this one that exports
// { id, name, fetchEvents } per _shape.js, then add one line here.
// Ticketmaster and Eventbrite-style sources drop straight in.

module.exports = [
  require('./ticketmelon'),
  require('./eventbrite'),
];
