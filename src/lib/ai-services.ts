import axios from 'axios';
import 'dotenv/config';
import { Document } from '@langchain/core/documents';

// STEP 1: Hugging Face for code summarization (better free tier)
export async function summarizeCode(doc: Document) {
  try {
    const code = doc.pageContent.slice(0, 10000);
    const HF_API_KEY = process.env.HUGGING_FACE_API_KEY; // Add this to your .env
    
    const response = await axios({
      url: 'https://api-inference.huggingface.co/models/Salesforce/codet5p-220m-py',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        inputs: `Summarize this code from ${doc.metadata.source}:\n\n${code}`,
        parameters: {
          max_new_tokens: 100,
          temperature: 0.3,
        },
      },
    });
    
    return response.data[0].generated_text;
  } catch (error) {
    console.error('Error generating summary:', error);
    return '';
  }
}

// STEP 2: Cohere for embeddings (excellent free tier)
export async function generateEmbeddings(text: string) {
  try {
    const COHERE_API_KEY = process.env.COHERE_API_KEY; // Add this to your .env
    
    const response = await axios({
      url: 'https://api.cohere.ai/v1/embed',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        texts: [text],
        model: 'embed-english-v3.0', // Good model with high free tier limits
        input_type: 'search_document',
      },
    });
    
    return response.data.embeddings[0]; // Return the embedding vector
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return null;
  }
}

// Modified document processing to use the new services with better rate limits
export const generateEmbeddingsForDocs = async (docs: Document[]) => {
  const results = [];
  const batchSize = 5; // Increase batch size, Cohere has better limits
  const delayBetweenRequests = 1000; // Only 1 second between requests
  
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Process in batches
  for (let i = 0; i < docs.length; i += batchSize) {
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(docs.length/batchSize)}`);
    
    const batchResults = [];
    const batch = docs.slice(i, i + batchSize);
    
    for (let j = 0; j < batch.length; j++) {
      const doc = batch[j];
      console.log(`Processing file ${i + j + 1}/${docs.length}: ${doc.metadata.source}`);
      
      try {
        const summary = await summarizeCode(doc);
        await sleep(delayBetweenRequests);
        
        const embedding = await generateEmbeddings(summary);
        if (embedding) {
          batchResults.push({
            summary,
            embedding,
            SourceCode: doc.pageContent,
            fileName: doc.metadata.source,
          });
        }
      } catch (error) {
        console.error(`Error processing ${doc.metadata.source}:`, error);
      }
      
      await sleep(delayBetweenRequests);
    }
    
    results.push(...batchResults.filter(Boolean));
  }
  
  return results;
};