// import { ButtonHTMLAttributes, CSSProperties, DetailedReactHTMLElement, ReactNode, RefObject, cloneElement, forwardRef, isValidElement, useRef } from 'react';
// import {AriaButtonProps, AriaOverlayProps, Overlay, useModalOverlay} from 'react-aria';
// import { OverlayTriggerProps, OverlayTriggerState } from 'react-stately';

// https://react-spectrum.adobe.com/react-aria/useModalOverlay.html
// Adding a dummy modal with useModalOverlay to see if this solves the problem

// // export const AliasDeletionButton3701 = () => {
// // 	return (
// // 		<ModalTrigger label="Open Dialog">
// // 			{/* {close => */}
// // 				<Dialog title="Enter your name">
// // 					<form style={{display: 'flex', flexDirection: 'column'}}>
// // 						<label htmlFor="first-name">First Name:</label>
// // 						<input id="first-name" />
// // 						<label htmlFor="last-name">Last Name:</label>
// // 						<input id="last-name" />
// // 						{/* <Button
// // 							onPress={close}
// // 							style={{marginTop: 10}}>
// // 							Submit
// // 						</Button> */}
// // 					</form>
// // 				</Dialog>
// // 			{/* } */}
// // 		</ModalTrigger>
// // 	);
// // }


// type ModalProps = {
// 	state: OverlayTriggerState;
// 	children: ReactNode;
// };

// const Modal = (props: ModalProps & AriaOverlayProps) => {
// 	const ref = useRef(null);
//   const { modalProps, underlayProps } = useModalOverlay(props, props.state, ref);

// 	return (
//     <Overlay>
//       <div
//         style={{
//           position: 'fixed',
//           zIndex: 100,
//           top: 0,
//           left: 0,
//           bottom: 0,
//           right: 0,
//           background: 'rgba(0, 0, 0, 0.5)',
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'center'
//         }}
//         {...underlayProps}
//       >
//         <p>Testing</p>
//         <div
//           {...modalProps}
//           ref={ref}
//           style={{
//             background: 'var(--page-background)',
//             border: '1px solid gray'
//           }}
//         >
//           {props.children}
//         </div>
//       </div>
//     </Overlay>
//   );
// }

// import {useOverlayTrigger} from 'react-aria';
// import {useOverlayTriggerState} from 'react-stately';
// import type {AriaButtonOptions, AriaDialogProps} from 'react-aria';
// import {useDialog} from 'react-aria';

// // Reuse the Button from your component library. See below for details.

// type TriggerProps = {
// 	label: string;
// 	// children: (close: () => void) => React.ReactElement<string | React.JSXElementConstructor<ReactNode>>;
// }

// // modal trigger
// export const AliasDeletionButton3701 = (props: TriggerProps & OverlayTriggerProps & AriaOverlayProps) => {
//   const state = useOverlayTriggerState(props);
//   const { triggerProps, overlayProps } = useOverlayTrigger(
//     { type: 'dialog' },
//     state
//   );
 
//   return (
//     <>
//       <Button {...triggerProps}>Open Dialog</Button>
//       {state.isOpen &&
//         (
//           <Modal {...props} state={state}>
//             {/* {close => */}
//             <Dialog title="Enter your name">
//               <form style={{display: 'flex', flexDirection: 'column'}}>
//                 <label htmlFor="first-name">First Name:</label>
//                 <input id="first-name" />
//                 <label htmlFor="last-name">Last Name:</label>
//                 <input id="last-name" />
//                 <Button
//                   onPress={state.close}
//                   style={{marginTop: 10}}>
//                   Submit
//                 </Button>
//               </form>
//             </Dialog>
//           {/* } */}
//           </Modal>
//         )}
//     </>
//   );
// }


// type DialogProps = {
//   title?: React.ReactNode;
//   children: React.ReactNode;
// }

// const Dialog = (props: DialogProps & AriaDialogProps) => {
//   const ref = useRef(null);
//   const { dialogProps, titleProps } = useDialog(props, ref);

//   return (
//     <div {...dialogProps} ref={ref} style={{ padding: 30 }}>
//       {props.title &&
//         (
//           <h3 {...titleProps} style={{ marginTop: 0 }}>
//             {props.title}
//           </h3>
//         )}
//       {props.children}
//     </div>
//   );
// }

// import {useButton} from 'react-aria';

// type Props = {
//   children: ReactNode;
//   style: CSSProperties;
// };

// const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & AriaButtonOptions<'button'>>(
//   (props, buttonRef) => {
// 	const ref = buttonRef as RefObject<HTMLButtonElement>;
// 	const { buttonProps } = useButton(props, ref);
// 	return (
// 		<button {...buttonProps} ref={ref} style={props.style}>
// 			{props.children}
// 		</button>
// 	);
// }
// );
// Button.displayName = "Button";