import { LightningElement } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import PDF from '@salesforce/resourceUrl/PDF';
import PDFWorker from '@salesforce/resourceUrl/PDFWorker';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PdfTextExtractor extends LightningElement {
    isLoading = false;
    extractedText = '';
    pdfjsLib = null;

    renderedCallback() {
        if (!this.pdfjsLib) {
            this.initializePDFJS();
        }
    }

    async initializePDFJS() {
        try {
            await loadScript(this, PDF);
            
            if (typeof window.pdfjsLib !== 'undefined') {
                this.pdfjsLib = window.pdfjsLib;
                this.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker;
                this.patchPDFJSForLWC();
            } else {
                throw new Error('PDF.js not found in window');
            }
        } catch (error) {
            console.error('Error loading PDF.js', error);
            this.showToast('Error', 'Failed to load PDF library', 'error');
        }
    }

    patchPDFJSForLWC() {
        if (typeof window !== 'undefined' && !window.pdfjsLib.ownerDocument) {
            window.pdfjsLib.ownerDocument = document;
        }
        
        if (typeof globalThis === 'undefined') {
            window.globalThis = window;
        }
    }

    handleBrowseClick(event) {
        event.stopPropagation();
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type === 'application/pdf') {
                this.processPDF(file);
            } else {
                this.showToast('Error', 'Please upload a PDF file', 'error');
            }
            document.body.removeChild(fileInput);
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.toggleDropAreaHighlight(false);
        
        const file = event.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            this.processPDF(file);
        } else {
            this.showToast('Error', 'Please upload a PDF file', 'error');
        }
    }

    async processPDF(file) {
        if (!this.pdfjsLib) {
            this.showToast('Error', 'PDF.js library not loaded yet. Please try again.', 'error');
            return;
        }

        this.isLoading = true;
        this.extractedText = '';

        try {
            const text = await this.extractTextFromPDF(file);
            this.extractedText = text;
        } catch (error) {
            console.error('Error extracting text:', error);
            this.showToast('Error', 'Failed to extract text from PDF. ' + error.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async extractTextFromPDF(file) {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            
            fileReader.onload = async () => {
                try {
                    const typedArray = new Uint8Array(fileReader.result);
                    const loadingTask = this.pdfjsLib.getDocument({
                        data: typedArray,
                        ownerDocument: document,
                        disableAutoFetch: true,
                        disableStream: true
                    });
                    
                    const pdf = await loadingTask.promise;
                    let fullText = '';
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const textItems = textContent.items.map(item => item.str);
                        fullText += textItems.join(' ') + '\n\n';
                    }
                    
                    resolve(fullText);
                } catch (error) {
                    reject(error);
                }
            };
            
            fileReader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            fileReader.readAsArrayBuffer(file);
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}