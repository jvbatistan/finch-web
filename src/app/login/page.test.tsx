import { render, screen } from "@testing-library/react";
import LoginPage from "@/app/login/page";

const replace = vi.fn();
const refresh = vi.fn();
const useAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/lib/useAuth", () => ({
  useAuth: () => useAuth(),
}));

vi.mock("@/lib/auth", () => ({
  login: vi.fn(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    useAuth.mockReturnValue({ status: "unauthenticated", refresh });
  });

  it("associa os campos de credenciais aos seus labels", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
  });
});
