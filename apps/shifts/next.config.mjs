/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bisicab/shared'],
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
    outputFileTracingIncludes: {
      '/api/**/*': [
        '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
        '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
        './node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      ],
    },
  },
};

export default nextConfig;
