const formidable = require('formidable');

formidable.IncomingForm.prototype.parse = async function (req, cb) {
  const form = this; // Alias for the IncomingForm instance

  // Setting up Promises for fields and files
  const fields = {};
  const files = {};

  const parsePromise = new Promise((resolve, reject) => {
    form
      .on('field', (name, value) => {
        fields[name] = value;
      })
      .on('file', (name, file) => {
        if (form.multiples) {
          if (files[name]) {
            if (!Array.isArray(files[name])) {
              files[name] = [files[name]];
            }
            files[name].push(file);
          } else {
            files[name] = [file];
          }
        } else {
          files[name] = file;
        }
      })
      .on('error', (err) => {
        reject(err);
      })
      .on('end', () => {
        resolve({ fields, files });
      });
  });

  // Handling serverless environments
  try {
    if (Buffer.isBuffer(req.rawBody)) {
      form.writeHeaders(req.headers);
      form.write(req.rawBody);
    } else if (Buffer.isBuffer(req.body)) {
      form.writeHeaders(req.headers);
      form.write(req.body);
    } else {
      form.writeHeaders(req.headers);

      req.on('aborted', () => {
        form.emit('error', new Error('Request aborted'));
      });

      req.on('data', (buffer) => {
        form.write(buffer);
      });
    }

    req.on('error', (err) => {
      form.emit('error', err);
    });

    req.on('end', () => {
      const err = form._parser.end();
      if (err) {
        form.emit('error', err);
      }
    });

    const result: any = await parsePromise;
    if (cb) cb(null, result.fields, result.files);

  } catch (err) {
    if (cb) cb(err, fields, files);
    form.emit('error', err);
  }

  return form;
};

module.exports = formidable;