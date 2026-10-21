/** Enter the public compact surface before exercising an inherited command. */
export async function findAction(role: "button" | "combobox", options: {name?:string|RegExp;exact?:boolean} = {}) {
  const {screen}=await import("@testing-library/react");
  const {default:userEvent}=await import("@testing-library/user-event");
  const user=userEvent.setup({document});
  const target=await screen.findByRole(role,{...options,hidden:true});
  const panel=target.closest<HTMLElement>('[data-context-return]');
  if(panel?.hidden) {
    const trigger=document.getElementById(panel.dataset.contextReturn!);
    if(!trigger) throw new Error("Context trigger is missing");
    await user.click(trigger);
  }
  for(let ancestor=target.parentElement;ancestor;ancestor=ancestor.parentElement) {
    if(ancestor.tagName==="DETAILS" && !ancestor.hasAttribute("open")) {
      const summary=ancestor.querySelector("summary");
      if(summary) await user.click(summary);
    }
  }
  return screen.findByRole(role,options);
}
