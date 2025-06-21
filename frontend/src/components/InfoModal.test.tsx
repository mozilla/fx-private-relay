import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InfoModal } from "./InfoModal";

describe("InfoModal", () => {
  const modalTitle = "Test Title";
  const modalBody = "This is the modal body";
  const onClose = jest.fn();

  it("renders modal title and body when isOpen is true", () => {
    render(
      <InfoModal
        isOpen={true}
        onClose={onClose}
        modalTitle={modalTitle}
        modalBodyText={modalBody}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(modalTitle)).toBeInTheDocument();
    expect(screen.getByText(modalBody)).toBeInTheDocument();
  });

  it("calls onClose when dismiss button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <InfoModal
        isOpen={true}
        onClose={onClose}
        modalTitle={modalTitle}
        modalBodyText={modalBody}
      />,
    );

    await user.click(screen.getByRole("button"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders custom React elements for title and body", () => {
    render(
      <InfoModal
        isOpen={true}
        onClose={onClose}
        modalTitle={<span data-testid="custom-title">Custom Title</span>}
        modalBodyText={<div data-testid="custom-body">Custom Body</div>}
      />,
    );

    expect(screen.getByTestId("custom-title")).toBeInTheDocument();
    expect(screen.getByTestId("custom-body")).toBeInTheDocument();
  });
});
