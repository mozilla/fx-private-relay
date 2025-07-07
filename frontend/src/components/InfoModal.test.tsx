import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InfoModal } from "./InfoModal";

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  modalTitle: "Test Title",
  modalBodyText: "This is the modal body",
};

// Helper function to render InfoModal with custom props if needed
function renderInfoModal(props = {}) {
  return render(<InfoModal {...defaultProps} {...props} />);
}

describe("InfoModal", () => {
  it("renders modal title and body when isOpen is true", () => {
    renderInfoModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(defaultProps.modalTitle)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.modalBodyText)).toBeInTheDocument();
  });

  it("calls onClose when dismiss button is clicked", async () => {
    const user = userEvent.setup();
    renderInfoModal();
    await user.click(screen.getByRole("button"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("renders custom React elements for title and body", () => {
    renderInfoModal({
      modalTitle: <span data-testid="custom-title">Custom Title</span>,
      modalBodyText: <div data-testid="custom-body">Custom Body</div>,
    });
    expect(screen.getByTestId("custom-title")).toBeInTheDocument();
    expect(screen.getByTestId("custom-body")).toBeInTheDocument();
  });
});
