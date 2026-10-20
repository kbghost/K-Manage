/// <reference types="vite/client" />

declare module "@hookform/resolvers/zod" {
  export const zodResolver: any;
}

declare module "@testing-library/user-event" {
  const userEvent: any;
  export default userEvent;
}
