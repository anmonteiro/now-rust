var fs = require('fs');


function exists(p) {
  return new Promise((resolve, reject) => {
    fs.exists(p, (err, exists) => {
      console.log(err, exists);
      if (err != null) {
        return reject(err);
      }

      return resolve(exists);
    });
  });
}

async function x() {
  const bar = await exists('src');
}

x()
