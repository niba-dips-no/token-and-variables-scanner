const fs = require('fs');
const path = require('path');

// Read the compiled JS and CSS
const js = fs.readFileSync(path.join(__dirname, 'dist', 'ui.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'dist', 'ui.css'), 'utf8');

// Create HTML with inlined JS and CSS
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Token and Variable Scanner</title>
  <style>
    ${css}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    ${js}
  </script>
</body>
</html>`;

// Write the final HTML file
fs.writeFileSync(path.join(__dirname, 'dist', 'ui.html'), html);
console.log('✓ UI HTML built with inlined JS and CSS');
