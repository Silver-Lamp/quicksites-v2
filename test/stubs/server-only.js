// A no-op stand-in for the `server-only` package under Jest.
//
// The real package has no runtime behaviour: it exists so that a CLIENT bundle importing a server
// module fails at build time. Jest is neither, so resolving it to nothing is faithful rather than
// permissive — and without this, any `lib/` module carrying the guard cannot be unit tested at all.
module.exports = {};
