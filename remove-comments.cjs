const fs = require('fs')
const path = require('path')
const strip = require('strip-comments')

const exts = ['.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.json']
const ignoreDirs = ['node_modules', 'dist', '.git', 'types']
const preserveKeywords = ['@ts-ignore', '<reference']

function shouldProcess(file) {
  return exts.includes(path.extname(file))
}

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      if (!ignoreDirs.includes(file)) walk(fullPath, callback)
    } else {
      if (shouldProcess(fullPath)) callback(fullPath)
    }
  })
}

function preserve(comment) {
  if (comment.value) {
    return preserveKeywords.some(keyword => comment.value.includes(keyword))
  }
  
  if (comment.nodes && Array.isArray(comment.nodes)) {
    const fullText = comment.nodes.map(node => node.value || '').join('')
    return preserveKeywords.some(keyword => fullText.includes(keyword))
  }
  
  return false
}

function processFile(file) {
  const content = fs.readFileSync(file, 'utf8')
  let stripped
  try {
    stripped = strip(content, { preserve })
  } catch (e) {
    throw e
  }
  fs.writeFileSync(file, stripped, 'utf8')
  console.log('Stripped comments from', file)
}

walk(__dirname, processFile) 