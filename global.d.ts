// global.d.ts

// Declare the SpeechRecognition constructors
interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
  
  // If you don't have proper types for SpeechRecognition, you can declare it as any
  declare var SpeechRecognition: any;
  declare var webkitSpeechRecognition: any;
  
  // Declare SpeechRecognitionEvent
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }
  