
const pdfImgConvert = require('pdf-img-convert');
const fs = require('fs');
const path = require('path');

async function test() {
    console.log("Starting conversion test...");
    try {
        // Create a dummy PDF file if none exists (simple text PDF won't verify image rendering perfectly but tests the lib loading)
        // Better: Try to convert an existing PDF from uploads if one exists, or fail gracefully.
        const uploadDir = path.join(__dirname, 'uploads');
        const files = fs.readdirSync(uploadDir);
        const pdfFile = files.find(f => f.endsWith('.pdf'));

        if (!pdfFile) {
            console.log("No PDF found in uploads to test. Please upload one via the app first.");
            return;
        }

        const pdfPath = path.join(uploadDir, pdfFile);
        console.log(`Converting: ${pdfPath}`);

        const outputImages = await pdfImgConvert.convert(pdfPath, {
            width: 800,
            height: 1100,
            page_numbers: [1]
        });

        console.log(`Success! Converted ${outputImages.length} images.`);
    } catch (e) {
        console.error("Test Failed:", e);
    }
}

test();
