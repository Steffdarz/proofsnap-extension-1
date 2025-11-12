/**
 * Authentication Service for ProofSnap Extension
 * Handles user login, signup, and token management
 */
import { ApiClient } from './ApiClient';

type LoginRequest = { email: string; password: string };
type LoginResponse = { auth_token: string };
type SignupRequest = {
  username: string;
  email: string;
  password: string;
  referral_code?: string;
  activation_method?: 'skip' | 'legacy' | 'code';
};
type SignupResponse = { auth_token: string };
type ResetPasswordRequest = { email: string };
type CustomUser = {
  id: number;
  username: string;
  email: string;
  address?: string;
  [key: string]: any;
};
type UserUpdateRequest = {
  language?: string;
  default_tag?: string;
  allow_c2pa_download?: boolean;
};

/**
 * Authentication Service
 * Manages user authentication and session state
 */
export class AuthService {
  private apiClient: ApiClient;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.apiClient.postPublic<LoginResponse>(
      '/auth/token/login/',
      credentials
    );

    // Store the auth token in the API client
    if (response.auth_token) {
      this.apiClient.setAuthToken(response.auth_token);
    }

    return response;
  }

  /**
   * Sign up with email and password
   */
  async signup(signupData: SignupRequest): Promise<SignupResponse> {
    const response = await this.apiClient.postPublic<SignupResponse>(
      '/auth/users/',
      signupData
    );

    // Store the auth token in the API client if provided
    if (response.auth_token) {
      this.apiClient.setAuthToken(response.auth_token);
    }

    return response;
  }

  /**
   * Request password reset
   */
  async resetPassword(resetData: ResetPasswordRequest): Promise<void> {
    await this.apiClient.postPublic('/auth/users/reset_password/', resetData);
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<CustomUser> {
    return await this.apiClient.getWithAuth<CustomUser>('/auth/users/me/');
  }

  /**
   * Update user data (config and profile)
   */
  async updateUser(userData: UserUpdateRequest): Promise<CustomUser> {
    return await this.apiClient.patchWithAuth<CustomUser>('/auth/users/me/', userData);
  }

  /**
   * Delete user account permanently
   */
  async deleteAccount(): Promise<void> {
    await this.apiClient.deleteWithAuth('/auth/users/me/');
    this.clearAuth();
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    return !!this.apiClient.getAuthToken();
  }

  /**
   * Get current auth token
   */
  getAuthToken(): string | undefined {
    return this.apiClient.getAuthToken();
  }

  /**
   * Set auth token manually (for token restoration)
   */
  setAuthToken(token: string): void {
    this.apiClient.setAuthToken(token);
  }

  /**
   * Clear authentication token from API client
   */
  clearAuth(): void {
    this.apiClient.clearAuthToken();
  }
}
