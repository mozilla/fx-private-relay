import React from 'react';
import { render, screen } from '@testing-library/react';
import { mockConfigModule } from "../../../../__mocks__/configMock";
import { UserMenu } from './UserMenu';
import { mockUseL10nModule } from '../../../../__mocks__/hooks/l10n';

jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../../../config.ts", () => mockConfigModule);
  
describe('<UserMenu>', () => {
  it('renders user menu', () => {
    render(<UserMenu style="test-style" />);
    
    // Test that the user menu items are rendered
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Manage Account')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  }); 
});
