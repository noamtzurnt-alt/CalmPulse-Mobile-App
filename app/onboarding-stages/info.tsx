import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  Animated,
  SafeAreaView,
  ImageBackground,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingImages } from '@/constants/Images';
import { saveOnboardingData, createOrUpdateUser } from '@/lib/userDataUtils';
import { auth } from '@/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface InfoStageProps {
  onComplete: () => void;
  onBack?: () => void;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface Question {
  id: number;
  text: string;
  options: string[];
}

const questions: Question[] = [
  {
    id: 1,
    text: "How do you identify?",
    options: [
      "Man 👨",
      "Woman 👩",
      "Non-binary / Other 🫂",
      "Prefer not to say 🤐"
    ]
  },
  {
    id: 2,
    text: "How are you feeling right now?",
    options: [
      "Stressed out 😤",
      "Sad and lost 😢",
      "Empty inside 🫥",
      "Not good about myself 😞"
    ]
  },
  {
    id: 3,
    text: "When are these feelings strongest for you?",
    options: [
      "When I'm alone 🏠",
      "With others 👥",
      "Too much on my mind 💭",
      "At night 🌙"
    ]
  },
  {
    id: 4,
    text: "What's been hardest to deal with lately?",
    options: [
      "Racing thoughts 🏃‍♂️",
      "Confusing emotions 🤯",
      "No sleep 😴",
      "Feeling disconnected 🚶‍♂️"
    ]
  },
  {
    id: 5,
    text: "What would you want to feel after your first time with CalmPulse?",
    options: [
      "Peace of mind 🧘‍♀️",
      "Relief for a moment 😌",
      "Understand myself better 🧠",
      "Not alone in this 🤝"
    ]
  }
];

export default function InfoStage({ onComplete, onBack }: InfoStageProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [sendButtonAnim] = useState(new Animated.Value(0));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [onboardingAnswers, setOnboardingAnswers] = useState({
    name: '',
    gender: '' as "man" | "woman" | "non-binary" | "prefer_not_to_say",
    feeling_now: '',
    feeling_strongest_when: '',
    struggling_with: '',
    desired_feeling: '',
  });
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showContinueButton, setShowContinueButton] = useState(false);

  useEffect(() => {
    // Start conversation sequence
    setTimeout(() => {
      addMessage("Hello", false);
      
      setTimeout(() => {
        setIsTyping(true);
        
        setTimeout(() => {
          setIsTyping(false);
          addMessage("I'm Pulse, your AI companion for wellness and emotional support.", false);
          
          setTimeout(() => {
            setIsTyping(true);
            
            setTimeout(() => {
              setIsTyping(false);
              addMessage("What's your name?", false);
              
              setTimeout(() => {
                setShowInput(true);
              }, 400);
            }, 600);
          }, 600);
        }, 600);
      }, 600);
    }, 1000);
  }, []);

  const addMessage = (text: string, isUser: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = () => {
    if (userInput.trim()) {
      // Save the user's name
      setOnboardingAnswers(prev => ({
        ...prev,
        name: userInput.trim()
      }));
      
      addMessage(userInput, true);
      setUserInput('');
      setShowInput(false);
      
      // Simulate AI response
      setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          const userName = userInput.trim();
          addMessage(`Nice to meet you ${userName}! I'm excited to help you on your wellness journey.`, false);
          
          // Start questions sequence
          setTimeout(() => {
            askNextQuestion();
          }, 1000);
        }, 800);
      }, 600);
    }
  };

  const askNextQuestion = useCallback(() => {
    console.log('🔍 askNextQuestion called, currentQuestionIndex:', currentQuestionIndex);
    if (currentQuestionIndex < questions.length) {
      // Show typing animation first
      setIsTyping(true);
      
      setTimeout(() => {
        setIsTyping(false);
        const question = questions[currentQuestionIndex];
        console.log('📝 Adding question:', question.text, 'at index:', currentQuestionIndex);
        addMessage(question.text, false);
        setShowOptions(true);
      }, 800);
    } else {
      // All questions completed
      setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          addMessage("Thank you for sharing with me. I'm here to support you on your journey.", false);
          setTimeout(() => {
            onComplete();
          }, 1000);
        }, 800);
      }, 1000);
    }
  }, [currentQuestionIndex]);

  const handleOptionSelect = (option: string) => {
    console.log('🎯 Option selected:', option, 'at index:', currentQuestionIndex);
    setSelectedOption(option);
    addMessage(option, true);
    setShowOptions(false);
    
    // Save the answer based on current question
    const currentQuestion = questions[currentQuestionIndex];
    let fieldName = '';
    
    switch (currentQuestion.id) {
      case 1: // Gender
        fieldName = 'gender';
        const genderMap: { [key: string]: "man" | "woman" | "non-binary" | "prefer_not_to_say" } = {
          "Man 👨": "man",
          "Woman 👩": "woman", 
          "Non-binary / Other 🫂": "non-binary",
          "Prefer not to say 🤐": "prefer_not_to_say"
        };
        setOnboardingAnswers(prev => ({
          ...prev,
          [fieldName]: genderMap[option] || "prefer_not_to_say"
        }));
        break;
      case 2: // Feeling now
        fieldName = 'feeling_now';
        setOnboardingAnswers(prev => ({
          ...prev,
          [fieldName]: option
        }));
        break;
      case 3: // Feeling strongest when
        fieldName = 'feeling_strongest_when';
        setOnboardingAnswers(prev => ({
          ...prev,
          [fieldName]: option
        }));
        break;
      case 4: // Struggling with
        fieldName = 'struggling_with';
        setOnboardingAnswers(prev => ({
          ...prev,
          [fieldName]: option
        }));
        break;
      case 5: // Desired feeling
        fieldName = 'desired_feeling';
        setOnboardingAnswers(prev => ({
          ...prev,
          [fieldName]: option
        }));
        break;
    }
    
    const newIndex = currentQuestionIndex + 1;
    console.log('📈 Index updated from', currentQuestionIndex, 'to', newIndex);
    setCurrentQuestionIndex(newIndex);
    setSelectedOption(null);
    
    // Use the updated index directly
    setTimeout(() => {
      console.log('🔍 Calling askNextQuestion with new index:', newIndex);
      if (newIndex < questions.length) {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          const question = questions[newIndex];
          console.log('📝 Adding question:', question.text, 'at index:', newIndex);
          addMessage(question.text, false);
          setShowOptions(true);
        }, 800);
      } else {
        // All questions completed
        setTimeout(() => {
          setIsTyping(true);
          setTimeout(() => {
            setIsTyping(false);
            addMessage("Thank you for sharing with me. I'm here to support you on your journey.", false);
            setTimeout(() => {
              setShowContinueButton(true);
            }, 1000);
          }, 800);
        }, 1000);
      }
    }, 600);
  };

  const handleContinue = async () => {
    try {
      // Check if user is authenticated
      const user = auth.currentUser;
      if (!user) {
        console.log('⚠️ No authenticated user during onboarding - saving to AsyncStorage');
        // Save to AsyncStorage for later transfer
        await AsyncStorage.setItem('tempOnboardingData', JSON.stringify(onboardingAnswers));
        console.log('✅ Onboarding data saved to AsyncStorage');
        onComplete();
        return;
      }

      // Save onboarding data to Firebase
      await saveOnboardingData(onboardingAnswers);
      console.log('✅ Onboarding data saved successfully');
      onComplete();
    } catch (error) {
      console.error('❌ Error saving onboarding data:', error);
      // Continue anyway even if saving fails
    onComplete();
    }
  };

  const renderMessage = (message: Message) => (
    <View
      key={message.id}
      style={[
        styles.messageContainer,
        message.isUser ? styles.userMessage : styles.aiMessage,
      ]}
    >
      <View style={[
        styles.messageBubble,
        message.isUser ? styles.userBubble : styles.aiBubble,
      ]}>
        <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={[
          styles.messageText,
          message.isUser ? styles.userText : styles.aiText,
        ]}>
          {message.text}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
        
        
        <View style={styles.content}>
          {/* Simple Pulse Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={OnboardingImages.pulseLogo}
              style={styles.pulseLogo}
              resizeMode="contain"
              onLoad={() => {
                console.log('✅ Pulse logo loaded');
              }}
              onError={(error) => {
                console.error('❌ Pulse logo error:', error);
              }}
            />
          </View>

          {/* Chat Container */}
          <View style={styles.chatContainer}>
            <ScrollView
              style={styles.messagesContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.messagesContent, { paddingBottom: 100 + insets.bottom }]}
              ref={(scrollView) => {
                if (scrollView) {
                  setTimeout(() => {
                    scrollView.scrollToEnd({ animated: true });
                  }, 100);
                }
              }}
            >
              {messages.map(renderMessage)}
              
              {/* Typing indicator */}
              {isTyping && (
                <View style={styles.typingContainer}>
                  <View style={styles.typingBubble}>
                    <View style={styles.typingDot} />
                    <View style={styles.typingDot} />
                    <View style={styles.typingDot} />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Options Container */}
          {showOptions && currentQuestionIndex < questions.length && (
            <View key={`options-${currentQuestionIndex}`} style={styles.optionsContainer}>
              <View style={styles.optionsGrid}>
                {questions[currentQuestionIndex].options.map((option, index) => {
                  console.log('🎨 Rendering option:', option, 'for question index:', currentQuestionIndex);
                  return (
                    <Pressable
                      key={`${currentQuestionIndex}-${index}`}
                      style={[
                        styles.optionButton,
                        selectedOption === option && styles.optionButtonSelected
                      ]}
                      onPress={() => handleOptionSelect(option)}
                    >
                      <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={[
                        styles.optionText,
                        selectedOption === option && styles.optionTextSelected
                      ]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Input Container - Fixed at bottom */}
          {showInput && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
              style={[styles.inputWrapper, { bottom: insets.bottom }]}
            >
              <View style={styles.inputContainer}>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    value={userInput}
                    onChangeText={(text) => {
                      // Allow letters from all languages and spaces
                      const filteredText = text.replace(/[^\p{L}\s]/gu, '');
                      setUserInput(filteredText);
                    }}
                    placeholder="Enter your name"
                    placeholderTextColor="rgba(0, 0, 0, 0.4)"
                    autoFocus={true}
                    maxLength={30}
                    allowFontScaling={false}
                    maxFontSizeMultiplier={1}
                  />
                  <Pressable
                    style={[
                      styles.sendButton,
                      userInput.trim() ? styles.sendButtonActive : styles.sendButtonInactive,
                    ]}
                    onPress={handleSendMessage}
                    disabled={!userInput.trim()}
                  >
                    <Ionicons
                      name="send"
                      size={20}
                      color={userInput.trim() ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)'}
                    />
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}

          {/* Continue Button */}
          {showContinueButton && (
            <View style={styles.continueContainer}>
              <Pressable style={styles.continueButton} onPress={handleContinue}>
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.continueText}>Continue</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 0,
  },
  pulseLogo: {
    width: 150,
    height: 150,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 10,
  },
  messagesContent: {
    paddingBottom: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  aiMessage: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: 'rgba(240, 240, 240, 0.95)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  aiText: {
    color: '#374151',
    fontWeight: '500',
  },
  typingContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  typingBubble: {
    backgroundColor: 'rgba(240, 240, 240, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
  },
  sendButtonInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 240, 240, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  inputWrapper: {
    position: 'absolute',
    // bottom מוזרק דינמית דרך insets.bottom
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  optionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionButton: {
    width: '48%',
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  optionButtonSelected: {
    backgroundColor: '#60A5FA',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  continueContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  continueButton: {
    backgroundColor: '#60A5FA',
    borderRadius: 25,
    paddingHorizontal: 40,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
