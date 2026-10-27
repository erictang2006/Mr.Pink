import {Component,type ReactNode} from 'react';
/** Keep a visual exception from unmounting the functional performance stage. */
export default class OpeningGuard extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onFailure();}
  render(){return this.state.failed?null:this.props.children;}
}
