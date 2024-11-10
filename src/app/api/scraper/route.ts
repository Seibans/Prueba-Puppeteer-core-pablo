import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const maxDuration = 20;

export async function POST(request: Request) {
  console.log('Starting POST request to /api/scraper');

  try {
    const { siteUrl } = await request.json();
    console.log('Recibido datos:', siteUrl);

    const isLocal = process.env.CHROME_EXECUTABLE_PATH ? true : false;
    console.log('Environment:', isLocal ? 'local' : 'production');

    const browserConfig = {
      args: isLocal ? [] : [...chromium.args, '--no-sandbox'],
      executablePath: isLocal
        ? process.env.CHROME_EXECUTABLE_PATH
        : await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v126.0.0/chromium-v126.0.0-pack.tar'),
      headless: true,
      ignoreHTTPSErrors: true,
    };

    console.log('Lanzando navegador con la configuracion', JSON.stringify(browserConfig, null, 2));

    const browser = await puppeteer.launch(browserConfig);
    console.log('Navegador iniciado');

    const page = await browser.newPage();
    console.log('Navegando a la página:', siteUrl);

    await page.goto(siteUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const pageTitle = await page.title();
    console.log('Titulo de la pagina:', pageTitle);

    const screenshot = await page.screenshot();
    console.log('Screenshot tomado con éxito');

    await browser.close();
    console.log('Nvegador cerrado');

    console.log('Subiendo a Cloudinary');
    const resource = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'scraper-screenshots' },
        (error, result) => {
          if (error) {
            console.error('Cloudinary error de subida:', error);
            reject(error);
            return;
          }
          resolve(result);
        }
      );
      uploadStream.end(screenshot);
    });

    console.log('Subida Exitosa:', resource);

    return Response.json({
      success: true,
      siteUrl,
      pageTitle,
      resource
    });

  } catch (error) {
    console.error('Error detallado:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}