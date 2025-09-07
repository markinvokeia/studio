
import { AverageBilling, PatientDemographics, AppointmentAttendance } from '../types';

export const averageBillingData: AverageBilling = {
    value: 458,
    change: 12.5,
    changeType: 'positive',
};

export const patientDemographicsData: PatientDemographics = {
    total: 352,
    data: [
        { type: 'New', count: 120, fill: 'hsl(var(--chart-1))' },
        { type: 'Recurrent', count: 232, fill: 'hsl(var(--chart-2))' },
    ],
};

export const appointmentAttendanceData: AppointmentAttendance = {
    value: 92,
    change: -1.5,
    changeType: 'negative',
};
