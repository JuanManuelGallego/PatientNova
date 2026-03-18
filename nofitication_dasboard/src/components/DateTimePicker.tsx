import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { lbl } from "../styles/theme";
import { useFetchAppointments } from "../api/useFetchAppointments";

export function DateTimePicker({
    date,
    onChanged,
}: {
    date: string;
    onChanged: (date: string) => void;
}) {
    const { appointments } = useFetchAppointments();

    const handleChange = (selectedDate: Dayjs | null) => {
        if (!selectedDate) return;

        const selectedDateObj = selectedDate.toDate();

        const isBooked = appointments.some((a) => {
            return new Date(a.date).getTime() === selectedDateObj.getTime();
        });

        if (isBooked) {
            alert("This time slot is already booked");
            return;
        }

        onChanged(selectedDateObj.toISOString());
    };

    return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            <label style={lbl}>Fecha y Hora</label>
            <DatePicker
                value={date ? dayjs(date) : null}
                onChange={handleChange}
                showTime={{
                    format: "HH:mm",
                    minuteStep: 5,
                }}
                showNow={false}
                needConfirm={false}
                format="DD/MM/YYYY HH:mm"
                placeholder="Selecciona fecha y hora"
                disabledDate={(current) => current && current.isBefore(dayjs(), "day")}
                disabledTime={() => ({
                    disabledHours: () => {
                        const hours = [];
                        for (let i = 0; i < 6; i++) hours.push(i);
                        for (let i = 21; i < 24; i++) hours.push(i);
                        return hours;
                    },
                    disabledMinutes: (hour) => {
                        if (hour === 6 || hour === 20) {
                            const minutes = [];
                            for (let i = 0; i < 60; i += 5) {
                                if (i > 0) minutes.push(i);
                            }
                            return minutes;
                        }
                        return [];
                    },
                })}
                style={{ width: "100%" }}
            />
        </div>
    );
}
