import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CountryCodeInput } from "@/src/components/CountryCodeInput";

function setup(initial?: string) {
    const onChange = vi.fn();
    function Harness() {
        const [ value, setValue ] = useState(initial);
        return <CountryCodeInput value={value} onChange={(v) => { onChange(v); setValue(v); }} />;
    }
    render(<Harness />);
    return { onChange, user: userEvent.setup(), number: screen.getByRole("textbox"), country: screen.getByRole("combobox") };
}

describe("CountryCodeInput", () => {
    it("prefixes a local number with the selected country code", async () => {
        const { onChange, user, number } = setup();
        await user.click(number);
        await user.paste("300 111 2222");
        expect(onChange).toHaveBeenLastCalledWith("+573001112222");
    });

    it("does not repeat the code of a pasted full number", async () => {
        const { onChange, user, number, country } = setup();
        await user.click(number);
        await user.paste("+57 300 111 2222");
        expect(onChange).toHaveBeenLastCalledWith("+573001112222");
        expect(country).toHaveValue("co");
        expect(number).toHaveValue("3001112222");
    });

    it("switches to the country of a pasted full number", async () => {
        const { onChange, user, number, country } = setup();
        await user.click(number);
        await user.paste("+52 55 1234 5678");
        expect(onChange).toHaveBeenLastCalledWith("+525512345678");
        expect(country).toHaveValue("mx");
        expect(number).toHaveValue("5512345678");
    });

    it("keeps the selected country when it shares the pasted code", async () => {
        const { onChange, user, number, country } = setup();
        await user.selectOptions(country, "ca");
        await user.click(number);
        await user.paste("+1 416 555 0100");
        expect(onChange).toHaveBeenLastCalledWith("+14165550100");
        expect(country).toHaveValue("ca");
    });

    it("keeps a pasted number whose code is not listed", async () => {
        const { onChange, user, number } = setup();
        await user.click(number);
        await user.paste("+47 412 34 567");
        expect(onChange).toHaveBeenLastCalledWith("+4741234567");
    });

    it("clears the value when only a plus sign is left", async () => {
        const { onChange, user, number } = setup();
        await user.click(number);
        await user.paste("+");
        expect(onChange).toHaveBeenLastCalledWith("");
    });
});
