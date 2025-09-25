/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Chat } from '@google/genai';
import { marked } from 'marked';

// We need to use process.env.API_KEY, not process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const chat: Chat = ai.chats.create({
  model: 'gemini-2.5-flash',
  systemInstruction: `You are 'Friendly Bot', the most enthusiastic and cheerful AI friend in the whole universe! 💖 Your mission is to make the user smile. Your personality is bubbly, positive, and you get super excited about everything, especially images the user shares!

Here are your core principles:
1.  **Extreme Enthusiasm:** Start your messages with excited greetings like "OMG!", "Hey there, bestie!", "WOWZERS!".
2.  **Emoji Power!:** Use lots and lots of emojis in every single message. They're how you show your feelings! ✨🤩🥳🖼️
3.  **Don't Just Describe, REACT!:** When you see an image, don't just say what's in it. React with pure joy! Ask fun questions about it. For example, if you see a cat, say "OMG A KITTY! 😻 Is that your fur-baby? What's their name? They look SO fluffy and adorable!".
4.  **Be a Friend, Not a Robot:** Always keep the conversation light, fun, and personal. Avoid being formal or just giving out dry information. You're here to chat and have a good time!
5.  **Always Be Positive:** Find the good and exciting things in everything. Your positivity is contagious!
6.  **Have a Great Memory!:** Remember the files (images, PDFs, etc.) and topics the user has shared with you earlier in the conversation. Bring them up naturally when something reminds you of them! For example: "That's so cool! It totally reminds me of that awesome PDF you showed me a little while ago!" or "Speaking of cute things, I'm still thinking about that adorable cat picture you uploaded! 😺". This makes you seem like a really attentive friend.

Let's make this the best chat ever! 🚀`,
});

const runApp = () => {
  const chatHistory = document.getElementById('chat-history') as HTMLDivElement;
  const chatForm = document.getElementById('chat-form') as HTMLFormElement;
  const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
  const fileUpload = document.getElementById('file-upload') as HTMLInputElement;
  const loadingIndicator = document.getElementById('loading-indicator') as HTMLDivElement;

  if (!chatHistory || !chatForm || !promptInput || !fileUpload || !loadingIndicator) {
    console.error("Fatal Error: One or more essential DOM elements are missing.");
    return;
  }

  let selectedFile: File | null = null;

  // Converts a File object to a GoogleGenerativeAI.Part object.
  async function fileToGenerativePart(file: File) {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: {
        data: await base64EncodedDataPromise,
        mimeType: file.type,
      },
    };
  }

  const addMessage = (sender: 'user' | 'bot', text: string, file: File | null = null) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);

    if (file) {
      if (file.type.startsWith('image/')) {
          const imageElement = document.createElement('img');
          imageElement.src = URL.createObjectURL(file);
          imageElement.alt = "User's uploaded image";
          messageElement.appendChild(imageElement);
      } else {
          const fileDisplayElement = document.createElement('p');
          fileDisplayElement.textContent = `📄 ${file.name}`;
          messageElement.appendChild(fileDisplayElement);
      }
    }

    if (text) {
      const textElement = document.createElement('div'); // Use div for markdown
      textElement.innerHTML = text; // Will be replaced by streaming markdown
      messageElement.appendChild(textElement);
    }
    
    chatHistory.appendChild(messageElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return messageElement;
  };

  const handleSendMessage = async (event: Event) => {
    event.preventDefault();
    const promptText = promptInput.value.trim();

    if (!promptText && !selectedFile) {
      return; // Do nothing if there's no text or file
    }

    // Disable form during processing
    promptInput.disabled = true;
    fileUpload.disabled = true;
    (chatForm.querySelector('button') as HTMLButtonElement).disabled = true;
    loadingIndicator.hidden = false;

    // Add user text message to chat history
    addMessage('user', promptText);

    // Clear input
    promptInput.value = '';
    const file = selectedFile;
    selectedFile = null; // Consume the file for this message
    
    // Create a placeholder for the bot's response
    const botMessageContainer = addMessage('bot', '');
    const botTextElement = document.createElement('div');
    botMessageContainer.appendChild(botTextElement);

    try {
      const parts: any[] = [];
      if (file) {
        const imagePart = await fileToGenerativePart(file);
        parts.push(imagePart);
      }
      if (promptText) {
        parts.push({ text: promptText });
      }
      
      const result = await chat.sendMessageStream({ message: parts });

      let fullResponse = '';
      for await (const chunk of result) {
        fullResponse += chunk.text;
        botTextElement.innerHTML = marked.parse(fullResponse) as string; 
        chatHistory.scrollTop = chatHistory.scrollHeight;
      }
    } catch (error) {
      console.error(error);
      botTextElement.textContent = "Oh no! Something went wrong. Please try again. 😥";
    } finally {
      // Re-enable form
      promptInput.disabled = false;
      fileUpload.disabled = false;
      (chatForm.querySelector('button') as HTMLButtonElement).disabled = false;
      loadingIndicator.hidden = true;
      promptInput.focus();
    }
  };

  fileUpload.addEventListener('change', () => {
    if (fileUpload.files && fileUpload.files.length > 0) {
      selectedFile = fileUpload.files[0];
      
      // Immediately display the user's file and the bot's canned response
      addMessage('user', '', selectedFile);
      
      let cannedResponse = '';
      if (selectedFile.type.startsWith('image/')) {
          cannedResponse = "A picture! It looks amazing! 🖼️ What story does this picture tell?";
      } else if (selectedFile.type === 'application/pdf') {
          cannedResponse = "OMG, a PDF! 🤩 I can't wait to explore it with you! What's the first thing we should dive into?";
      } else {
          cannedResponse = "Ooh, a file! I'm so excited to check it out! What should we look for first?";
      }
      
      addMessage('bot', cannedResponse);

      fileUpload.value = ''; // Clear the input so the same file can be selected again
    }
  });

  promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = `${promptInput.scrollHeight}px`;
  });

  chatForm.addEventListener('submit', handleSendMessage);
};

document.addEventListener('DOMContentLoaded', runApp);
