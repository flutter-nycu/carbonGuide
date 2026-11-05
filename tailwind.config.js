export default {
  // The RAG workspace is styled by rag/styles.css inside its shadow root; keep its class names out of Tailwind.
  content: ['./push-admin.html', './src/push-admin/**/*.{ts,tsx}', '!./src/push-admin/rag/**'],
  theme: { extend: {} },
  plugins: [],
}
