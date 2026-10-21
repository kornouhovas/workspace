/** Enter the public compact surface before exercising an inherited command. */
export async function findAction(role: "button" | "combobox" | "searchbox", options: {name?:string|RegExp;exact?:boolean} = {}) {
  const {screen,waitFor}=await import("@testing-library/react");
  const {default:userEvent}=await import("@testing-library/user-event");
  const user=userEvent.setup({document});
  const target=await waitFor(()=>{
    const controls=screen.queryAllByRole(role,{...options,hidden:true}).filter(control=>!control.closest('[aria-hidden="true"]'));
    if(controls.length!==1) throw new Error(`Expected one owned ${role}, found ${controls.length}: ${String(options.name)}`);
    return controls[0];
  });
  const panels:HTMLElement[]=[];
  for(let ancestor=target.parentElement;ancestor;ancestor=ancestor.parentElement) {
    if(ancestor.hasAttribute('data-context-return')) panels.unshift(ancestor);
  }
  for(const panel of panels) if(panel.hidden) {
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
