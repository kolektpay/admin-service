export interface EmailUser {
  email: string;
  firstName: string;
  lastName: string;
}

export class Emails {
  public static readonly emails = [
    {
      title: "PAYMENT_ITEMS_NEED_APPROVAL",
      subject: "Payment items have been generated that need approval",
      content: `
    
        <p>There are payment items that require your approval.</p>
        <p>Please review and take the necessary action.</p>
  `,
    },

    {
      title: "PAYMENT_SUCCESSFUL",
      subject: "Payment Successful",
      content: () => `<p>Your payment has been successfully processed.</p>`,
    },
    {
      title: "PAYMENT_FAILED",
      subject: "Payment Failed",
      content: () =>
        `<p>Unfortunately, we were unable to process your payment.</p>`,
    },
  ];

  public static getEmail(title: string) {
    return this.emails.find((email) => email.title === title);
  }
}
