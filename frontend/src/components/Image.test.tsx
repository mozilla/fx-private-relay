import { render } from "@testing-library/react";

// Import the actual Image module
const ImageModule = jest.requireActual("./Image");
const Image = ImageModule.default;

// Mock next/image's getImageProps to return predictable props
jest.mock("next/image", () => ({
  __esModule: true,
  default: jest.fn(),
  getImageProps: jest.fn((props) => {
    // Simulate what Next.js does - it might add inline styles
    const { alt, src, width, height, ...rest } = props;
    return {
      props: {
        src,
        alt,
        width,
        height,
        style: props.mockStyle || { color: "transparent" }, // Default to the transparent style
        className: props.mockClassName || "",
        ...rest,
      },
    };
  }),
}));

describe("Image", () => {
  it("renders an img element with basic props", () => {
    const { container } = render(
      <Image src="/test.png" alt="Test image" width={100} height={100} />,
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/test.png");
    expect(img).toHaveAttribute("alt", "Test image");
  });

  it("converts color:transparent inline style to CSS class", () => {
    const { container } = render(
      <Image
        src="/test.png"
        alt="Test"
        width={100}
        height={100}
        // @ts-expect-error - mockStyle is for testing
        mockStyle={{ color: "transparent" }}
      />,
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const img = container.querySelector("img");
    expect(img?.className).toContain("transparent");
  });

  it("preserves existing className when adding transparent class", () => {
    const { container } = render(
      <Image
        src="/test.png"
        alt="Test"
        width={100}
        height={100}
        // @ts-expect-error - mockClassName is for testing
        mockClassName="existing-class"
        // @ts-expect-error - mockStyle is for testing
        mockStyle={{ color: "transparent" }}
      />,
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const img = container.querySelector("img");
    expect(img?.className).toContain("existing-class");
    expect(img?.className).toContain("transparent");
  });

  it("does not add inline style attribute when converting to class", () => {
    const { container } = render(
      <Image
        src="/test.png"
        alt="Test"
        width={100}
        height={100}
        // @ts-expect-error - mockStyle is for testing
        mockStyle={{ color: "transparent" }}
      />,
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const img = container.querySelector("img");
    expect(img).not.toHaveAttribute("style");
  });

  it("renders without className when no style and no existing className", () => {
    const { container } = render(
      <Image
        src="/test.png"
        alt="Test"
        width={100}
        height={100}
        // @ts-expect-error - mockStyle is for testing
        mockStyle={{}}
        // @ts-expect-error - mockClassName is for testing
        mockClassName=""
      />,
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const img = container.querySelector("img");
    expect(img).not.toHaveAttribute("class");
  });

  it("preserves alt text correctly", () => {
    const { container } = render(
      <Image
        src="/test.png"
        alt="Descriptive alt text"
        width={100}
        height={100}
      />,
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "Descriptive alt text");
  });
});
