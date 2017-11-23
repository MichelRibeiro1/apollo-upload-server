'use strict'

Object.defineProperty(exports, '__esModule', {
  value: true
})
exports.apolloUploadExpress = exports.apolloUploadKoa = exports.processRequest = exports.GraphQLUpload = void 0

var _graphql = require('graphql')

var _busboy = _interopRequireDefault(require('busboy'))

var _objectPath = _interopRequireDefault(require('object-path'))

function _interopRequireDefault(obj) {
  return obj && obj.__esModule
    ? obj
    : {
        default: obj
      }
}

const GraphQLUpload = new _graphql.GraphQLScalarType({
  name: 'Upload',
  description:
    'The `Upload` scalar type represents a file upload promise that resolves ' +
    'an object containing `stream`, `filename`, `mimetype` and `encoding`.',
  parseValue: value => value,

  parseLiteral() {
    throw new Error('Upload scalar literal unsupported')
  },

  serialize() {
    throw new Error('Upload scalar serialization unsupported')
  }
})
exports.GraphQLUpload = GraphQLUpload

const processRequest = (
  request,
  { maxFieldSize, maxFileSize, maxFiles } = {}
) =>
  new Promise(resolve => {
    const busboy = new _busboy.default({
      headers: request.headers,
      limits: {
        fieldSize: maxFieldSize,
        fields: 2,
        fileSize: maxFileSize,
        files: maxFiles
      }
    })
    let operations
    let operationsPath
    busboy.on('field', (fieldName, value) => {
      switch (fieldName) {
        case 'operations':
          operations = JSON.parse(value)
          operationsPath = (0, _objectPath.default)(operations)
          break

        case 'map': {
          for (const [mapFieldName, paths] of Object.entries(
            JSON.parse(value)
          )) {
            const upload = new Promise(resolve =>
              busboy.on(
                'file',
                (fieldName, stream, filename, encoding, mimetype) =>
                  fieldName === mapFieldName &&
                  resolve({
                    stream,
                    filename,
                    mimetype,
                    encoding
                  })
              )
            )

            for (const path of paths) operationsPath.set(path, upload)
          }

          resolve(operations)
        }
      }
    })
    request.pipe(busboy)
  })

exports.processRequest = processRequest

const apolloUploadKoa = options => (ctx, next) => {
  if (ctx.request.is('multipart/form-data'))
    processRequest(ctx.req, options).then(r => {
      ctx.request.body = r
      next()
    })
}

exports.apolloUploadKoa = apolloUploadKoa

const apolloUploadExpress = options => (request, response, next) => {
  if (!request.is('multipart/form-data')) return next()
  processRequest(request, options)
    .then(body => {
      request.body = body
      next()
    })
    .catch(next)
}

exports.apolloUploadExpress = apolloUploadExpress
