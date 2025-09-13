import { type AuthInput, type SuccessResponse } from '../schema';

export const authenticate = async (input: AuthInput): Promise<SuccessResponse> => {
  try {
    // Validate credentials against hardcoded values
    // Username: "kedar", Password: "1"
    if (input.username === 'kedar' && input.password === '1') {
      return { 
        success: true, 
        message: 'Authentication successful' 
      };
    }

    // Return failure for invalid credentials
    return { 
      success: false, 
      message: 'Invalid credentials' 
    };
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
};