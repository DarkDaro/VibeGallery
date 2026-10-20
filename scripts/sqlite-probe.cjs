const D = require('better-sqlite3');
const d = new D(':memory:');
d.exec('create table t(a)');
d.close();
console.log('SQLITE_ABI_OK');
