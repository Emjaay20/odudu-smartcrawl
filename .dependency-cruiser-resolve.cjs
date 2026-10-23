// What dependency-cruiser reads from a bundler configuration: the alias the
// docs app's imports use, so its layer rules see the files they name.
module.exports = {
  resolve: { alias: { '@site': `${__dirname}/apps/docs` } },
};
